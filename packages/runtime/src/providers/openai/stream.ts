import type { AgentDefinition, RuntimeEvent, RuntimeInput } from '@hexos/common';
import OpenAI from 'openai';
import type { ProviderDependencies } from '../shared/types.js';

/**
 * @description
 * Parameters for streaming chat completions with the OpenAI provider.
 *
 * @docsCategory llm-providers
 */
export interface OpenAIStreamParams {
  client: OpenAI;
  input: RuntimeInput;
  agent: AgentDefinition;
  messageId: string;
  currentAgentId: string;
  tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
  dependencies: ProviderDependencies;
  maxIterationsExceededCode: string;
}

/**
 * @description
 * Streams chat completions from OpenAI with support for tool calling and agent iteration.
 *
 * Orchestrates the full LLM interaction cycle: sends messages to OpenAI's chat completion API,
 * streams text deltas, handles tool calls with approval workflows, executes tools, and returns
 * results to the LLM. Implements an agentic loop that continues until the model produces a final
 * response or reaches the maximum iteration limit.
 *
 * The function yields RuntimeEvent objects for each stage: text-delta for streaming content,
 * tool-call-start/args/result/error for tool execution phases, approval-required for human-in-the-loop
 * decisions, and text-complete when the conversation is finished.
 *
 * @param params - Configuration object containing client, agent, tools, and dependencies
 * @yields RuntimeEvent objects representing each stage of the streaming interaction
 * @returns AsyncGenerator that completes when the agent finishes or hits iteration limit
 *
 * @docsCategory llm-providers
 *
 * @see {@link RuntimeEvent} for all possible event types
 * @see {@link ProviderDependencies} for infrastructure dependencies
 * @see {@link ToolDefinition} for tool configuration
 */
export async function* streamWithOpenAIProvider({
  client,
  input,
  agent,
  messageId,
  currentAgentId,
  tools,
  dependencies,
  maxIterationsExceededCode,
}: OpenAIStreamParams): AsyncGenerator<RuntimeEvent> {
  const systemPrompt =
    typeof agent.systemPrompt === 'function'
      ? agent.systemPrompt({
          conversationId: input.conversationId,
          userId: input.userId,
          frontendContext: input.context ?? {},
        })
      : agent.systemPrompt;

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: input.message },
  ];

  let fullContent = '';
  let iteration = 0;
  const maxIterations = agent.maxIterations ?? 10;
  let completed = false;

  while (iteration < maxIterations) {
    iteration++;

    const stream = await dependencies.withInfrastructureRetry(async () =>
      client.chat.completions.create({
        model: agent.model.model,
        max_tokens: agent.model.maxTokens ?? 4096,
        messages,
        tools,
        stream: true,
      })
    );

    const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let hasToolCalls = false;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullContent += delta.content;
        yield {
          type: 'text-delta',
          messageId,
          delta: delta.content,
        };
      }

      if (delta?.tool_calls) {
        hasToolCalls = true;
        for (const toolCall of delta.tool_calls) {
          const existing = toolCalls.get(toolCall.index);

          if (!existing && toolCall.id && toolCall.function?.name) {
            toolCalls.set(toolCall.index, {
              id: toolCall.id,
              name: toolCall.function.name,
              arguments: toolCall.function.arguments ?? '',
            });

            yield {
              type: 'tool-call-start',
              toolCallId: toolCall.id,
              toolName: toolCall.function.name,
              agentId: currentAgentId,
            };
          } else if (existing && toolCall.function?.arguments) {
            existing.arguments += toolCall.function.arguments;
          }
        }
      }
    }

    if (hasToolCalls && toolCalls.size > 0) {
      const toolCallsArray = Array.from(toolCalls.values());
      const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];

      messages.push({
        role: 'assistant',
        tool_calls: toolCallsArray.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      });

      for (const toolCall of toolCallsArray) {
        const toolDef = agent.tools.find((t) => t.name === toolCall.name);

        if (toolDef) {
          try {
            const toolInput = JSON.parse(toolCall.arguments || '{}');

            yield {
              type: 'tool-call-args',
              toolCallId: toolCall.id,
              args: toolInput,
            };

            if (dependencies.hooks?.onToolCall) {
              await dependencies.hooks.onToolCall(toolCall.name, toolInput);
            }

            const toolContext = dependencies.buildToolContext(input, currentAgentId);

            if (dependencies.requiresApproval(toolDef, toolContext)) {
              yield {
                type: 'approval-required',
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                args: toolInput,
                agentId: currentAgentId,
              };

              const decision = await dependencies.waitForApproval(
                input.conversationId,
                toolCall.id,
                toolCall.name,
                toolDef,
                toolInput,
                currentAgentId
              );

              if (!decision.approved) {
                yield {
                  type: 'tool-call-error',
                  toolCallId: toolCall.id,
                  error: decision.reason ?? 'User rejected the tool call',
                  code: decision.code,
                };

                toolResults.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: `Tool execution rejected by user: ${decision.reason ?? 'No reason provided'}`,
                });
                continue;
              }
            }

            const result = await dependencies.executeToolWithGuards(toolDef, toolInput, toolContext);

            yield {
              type: 'tool-call-result',
              toolCallId: toolCall.id,
              result,
            };

            if (dependencies.hooks?.onToolResult) {
              await dependencies.hooks.onToolResult(toolCall.name, result);
            }

            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const info = dependencies.getErrorInfo(error);

            yield {
              type: 'tool-call-error',
              toolCallId: toolCall.id,
              error: info.message,
              code: info.code,
            };

            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: `Error: ${info.message}`,
            });
          }
        }
      }

      messages.push(...toolResults);
    } else {
      completed = true;
      break;
    }
  }

  if (!completed) {
    yield {
      type: 'error',
      error: `Maximum iteration limit (${maxIterations}) reached for agent "${currentAgentId}".`,
      code: maxIterationsExceededCode,
    };
    return;
  }

  yield {
    type: 'text-complete',
    messageId,
    content: fullContent,
  };
}
