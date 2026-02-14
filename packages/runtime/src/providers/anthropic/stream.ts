import Anthropic from '@anthropic-ai/sdk';
import type { AgentDefinition, RuntimeEvent, RuntimeInput } from '@hexos/common';
import type { ProviderDependencies } from '../shared/types.js';

/**
 * @description
 * Parameters for the Anthropic streaming function.
 *
 * Contains all necessary inputs for streaming with the Anthropic Messages API,
 * including client instance, user input, agent configuration, converted tools,
 * and runtime dependencies for tool execution and approval flows.
 *
 * @see {@link streamWithAnthropicProvider} for usage
 * @see {@link RuntimeInput} for input structure
 * @see {@link AgentDefinition} for agent configuration
 * @see {@link ProviderDependencies} for runtime dependencies
 *
 * @docsCategory llm-providers
 */
export interface AnthropicStreamParams {
  client: Anthropic;
  input: RuntimeInput;
  agent: AgentDefinition;
  messageId: string;
  currentAgentId: string;
  tools?: Anthropic.Tool[];
  dependencies: ProviderDependencies;
  maxIterationsExceededCode: string;
}

/**
 * @description
 * Streams LLM responses and tool executions using the Anthropic Messages API.
 *
 * This generator function orchestrates the complete agent-tool interaction loop:
 * 1. Builds system prompt (static or dynamic) from agent definition
 * 2. Streams LLM response chunks, yielding text-delta events
 * 3. Detects tool calls and yields tool-call-start events
 * 4. Parses tool arguments and yields tool-call-args events
 * 5. Optionally waits for approval via approval-required/waitForApproval
 * 6. Executes tools via dependencies.executeToolWithGuards
 * 7. Yields tool-call-result or tool-call-error events
 * 8. Continues conversation with tool results until completion or max iterations
 *
 * Supports extended thinking (reasoning-delta events) and lifecycle hooks
 * (onToolCall, onToolResult). All infrastructure errors are retried via
 * dependencies.withInfrastructureRetry.
 *
 * @param params - Streaming parameters including client, input, agent, and dependencies
 *
 * @yields RuntimeEvent instances for each streaming event
 *
 * @see {@link RuntimeEvent} for event types
 * @see {@link AgentRuntime} for runtime orchestration
 * @see {@link ToolDefinition} for tool structure
 * @see {@link ProviderDependencies} for injected runtime operations
 *
 * @docsCategory llm-providers
 */
export async function* streamWithAnthropicProvider({
  client,
  input,
  agent,
  messageId,
  currentAgentId,
  tools,
  dependencies,
  maxIterationsExceededCode,
}: AnthropicStreamParams): AsyncGenerator<RuntimeEvent> {
  const systemPrompt =
    typeof agent.systemPrompt === 'function'
      ? agent.systemPrompt({
          conversationId: input.conversationId,
          userId: input.userId,
          frontendContext: input.context ?? {},
        })
      : agent.systemPrompt;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: input.message }];

  let fullContent = '';
  let iteration = 0;
  const maxIterations = agent.maxIterations ?? 10;
  let completed = false;

  while (iteration < maxIterations) {
    iteration++;

    const stream = await dependencies.withInfrastructureRetry(async () =>
      client.messages.stream({
        model: agent.model.model,
        max_tokens: agent.model.maxTokens ?? 4096,
        system: systemPrompt,
        messages,
        tools,
      })
    );

    let currentToolUse: { id: string; name: string; input: string } | null = null;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    let hasToolUse = false;
    let isThinkingBlock = false;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          hasToolUse = true;
          currentToolUse = {
            id: event.content_block.id,
            name: event.content_block.name,
            input: '',
          };

          yield {
            type: 'tool-call-start',
            toolCallId: event.content_block.id,
            toolName: event.content_block.name,
            agentId: currentAgentId,
          };
        } else if (event.content_block.type === 'thinking') {
          isThinkingBlock = true;
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          yield {
            type: 'text-delta',
            messageId,
            delta: event.delta.text,
          };
        } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.input += event.delta.partial_json;
        } else if (event.delta.type === 'thinking_delta') {
          yield {
            type: 'reasoning-delta',
            messageId,
            delta: (event.delta as { type: 'thinking_delta'; thinking: string }).thinking,
          };
        }
      } else if (event.type === 'content_block_stop') {
        if (isThinkingBlock) {
          isThinkingBlock = false;
        }
      }

      if (event.type === 'content_block_stop' && currentToolUse) {
        const toolUseId = currentToolUse.id;
        const toolUseName = currentToolUse.name;
        const toolUseInput = currentToolUse.input;

        const toolDef = agent.tools.find((t) => t.name === toolUseName);

        if (toolDef) {
          try {
            const toolInput = JSON.parse(toolUseInput || '{}');

            yield {
              type: 'tool-call-args',
              toolCallId: toolUseId,
              args: toolInput,
            };

            if (dependencies.hooks?.onToolCall) {
              await dependencies.hooks.onToolCall(toolUseName, toolInput);
            }

            const toolContext = dependencies.buildToolContext(input, currentAgentId);

            if (dependencies.requiresApproval(toolDef, toolContext)) {
              yield {
                type: 'approval-required',
                toolCallId: toolUseId,
                toolName: toolUseName,
                args: toolInput,
                agentId: currentAgentId,
              };

              const decision = await dependencies.waitForApproval(
                input.conversationId,
                toolUseId,
                toolUseName,
                toolDef,
                toolInput,
                currentAgentId
              );

              if (!decision.approved) {
                yield {
                  type: 'tool-call-error',
                  toolCallId: toolUseId,
                  error: decision.reason ?? 'User rejected the tool call',
                  code: decision.code,
                };

                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: toolUseId,
                  content: `Tool execution rejected by user: ${decision.reason ?? 'No reason provided'}`,
                  is_error: true,
                });

                currentToolUse = null;
                continue;
              }
            }

            const result = await dependencies.executeToolWithGuards(toolDef, toolInput, toolContext);

            yield {
              type: 'tool-call-result',
              toolCallId: toolUseId,
              result,
            };

            if (dependencies.hooks?.onToolResult) {
              await dependencies.hooks.onToolResult(toolUseName, result);
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: JSON.stringify(result),
            });
          } catch (error) {
            const info = dependencies.getErrorInfo(error);

            yield {
              type: 'tool-call-error',
              toolCallId: toolUseId,
              error: info.message,
              code: info.code,
            };

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUseId,
              content: `Error: ${info.message}`,
              is_error: true,
            });
          }
        }

        currentToolUse = null;
      }
    }

    if (hasToolUse && toolResults.length > 0) {
      const finalMessage = await stream.finalMessage();

      messages.push({
        role: 'assistant',
        content: finalMessage.content,
      });

      messages.push({
        role: 'user',
        content: toolResults,
      });
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
