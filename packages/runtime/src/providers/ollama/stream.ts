import type { AgentDefinition, RuntimeEvent, RuntimeInput } from '@hexos/common';
import { Ollama } from 'ollama';
import type { ProviderDependencies } from '../shared/types.js';
import type { OllamaTool } from './tools.js';

/**
 * @description
 * Parameters for streaming chat completions with the Ollama provider.
 *
 * @docsCategory llm-providers
 */
export interface OllamaStreamParams {
  client: Ollama;
  input: RuntimeInput;
  agent: AgentDefinition;
  messageId: string;
  currentAgentId: string;
  tools?: OllamaTool[];
  dependencies: ProviderDependencies;
  maxIterationsExceededCode: string;
}

/**
 * @description
 * Streams chat completions from Ollama with support for tool calling and agent iteration.
 *
 * Orchestrates the full LLM interaction cycle with locally-hosted Ollama models: sends messages
 * to Ollama's chat API, streams text deltas, handles tool calls with approval workflows, executes
 * tools, and returns results to the LLM. Implements an agentic loop that continues until the model
 * produces a final response or reaches the maximum iteration limit.
 *
 * The function yields RuntimeEvent objects for each stage: text-delta for streaming content,
 * tool-call-start/args/result/error for tool execution phases, approval-required for human-in-the-loop
 * decisions, and text-complete when the conversation is finished. Tool call IDs are generated using
 * crypto.randomUUID since Ollama does not provide them in the response.
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
export async function* streamWithOllamaProvider({
  client,
  input,
  agent,
  messageId,
  currentAgentId,
  tools,
  dependencies,
  maxIterationsExceededCode,
}: OllamaStreamParams): AsyncGenerator<RuntimeEvent> {
  const systemPrompt =
    typeof agent.systemPrompt === 'function'
      ? agent.systemPrompt({
          conversationId: input.conversationId,
          userId: input.userId,
          frontendContext: input.context ?? {},
        })
      : agent.systemPrompt;

  const messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: input.message },
  ];

  let fullContent = '';
  let iteration = 0;
  const maxIterations = agent.maxIterations ?? 10;
  let completed = false;

  while (iteration < maxIterations) {
    iteration++;

    const response = await dependencies.withInfrastructureRetry(async () =>
      client.chat({
        model: agent.model.model,
        messages,
        tools,
        stream: true,
      })
    );

    let hasToolCalls = false;
    const pendingToolCalls: { name: string; arguments: Record<string, unknown> }[] = [];

    for await (const chunk of response) {
      if (chunk.message?.content) {
        fullContent += chunk.message.content;
        yield {
          type: 'text-delta',
          messageId,
          delta: chunk.message.content,
        };
      }

      if (chunk.message?.tool_calls) {
        hasToolCalls = true;
        for (const toolCall of chunk.message.tool_calls) {
          pendingToolCalls.push({
            name: toolCall.function.name,
            arguments: toolCall.function.arguments,
          });
        }
      }
    }

    if (hasToolCalls && pendingToolCalls.length > 0) {
      messages.push({
        role: 'assistant',
        content: fullContent,
      });

      for (const toolCall of pendingToolCalls) {
        const toolCallId = crypto.randomUUID();

        yield {
          type: 'tool-call-start',
          toolCallId,
          toolName: toolCall.name,
          agentId: currentAgentId,
        };

        yield {
          type: 'tool-call-args',
          toolCallId,
          args: toolCall.arguments,
        };

        const toolDef = agent.tools.find((t) => t.name === toolCall.name);

        if (toolDef) {
          try {
            if (dependencies.hooks?.onToolCall) {
              await dependencies.hooks.onToolCall(toolCall.name, toolCall.arguments);
            }

            const toolContext = dependencies.buildToolContext(input, currentAgentId);

            if (dependencies.requiresApproval(toolDef, toolContext)) {
              yield {
                type: 'approval-required',
                toolCallId,
                toolName: toolCall.name,
                args: toolCall.arguments,
                agentId: currentAgentId,
              };

              const decision = await dependencies.waitForApproval(
                input.conversationId,
                toolCallId,
                toolCall.name,
                toolDef,
                toolCall.arguments,
                currentAgentId
              );

              if (!decision.approved) {
                yield {
                  type: 'tool-call-error',
                  toolCallId,
                  error: decision.reason ?? 'User rejected the tool call',
                  code: decision.code,
                };

                messages.push({
                  role: 'tool',
                  content: `Tool execution rejected by user: ${decision.reason ?? 'No reason provided'}`,
                });
                continue;
              }
            }

            const result = await dependencies.executeToolWithGuards(
              toolDef,
              toolCall.arguments,
              toolContext
            );

            yield {
              type: 'tool-call-result',
              toolCallId,
              result,
            };

            if (dependencies.hooks?.onToolResult) {
              await dependencies.hooks.onToolResult(toolCall.name, result);
            }

            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
            });
          } catch (error) {
            const info = dependencies.getErrorInfo(error);

            yield {
              type: 'tool-call-error',
              toolCallId,
              error: info.message,
              code: info.code,
            };

            messages.push({
              role: 'tool',
              content: `Error: ${info.message}`,
            });
          }
        }
      }

      fullContent = '';
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
