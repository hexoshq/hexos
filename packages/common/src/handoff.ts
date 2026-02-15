/**
 * @description
 * Historical record of an agent-to-agent handoff during a conversation.
 *
 * Stored in the handoff history to provide context about conversation routing decisions.
 * Each record captures which agents were involved, the reason for the handoff, and when
 * it occurred.
 *
 * Related: {@link HandoffResult} triggers the handoff, {@link HandoffIndicator} displays it,
 * {@link AgentRuntime} records it during streaming.
 *
 * @docsCategory tools
 */
export interface HandoffRecord {
  from: string;
  to: string;
  reason: string;
  context?: string;
  timestamp: Date;
}

/**
 * @description
 * Marker object returned by handoff tools to signal an agent-to-agent transition.
 *
 * When a tool returns an object with `__handoff: true`, the runtime detects it via
 * {@link isHandoffResult} and switches the active agent to `targetAgent`. The `reason`
 * field is included in the `agent-handoff` {@link RuntimeEvent} for UI display.
 *
 * Related: {@link isHandoffResult} detects this marker, {@link HandoffRecord} stores the history,
 * {@link generateHandoffTools} creates tools that return this type.
 *
 * @docsCategory tools
 */
export interface HandoffResult {
  __handoff: true;
  targetAgent: string;
  reason: string;
  context?: string;
}

/**
 * @description
 * Input schema for auto-generated handoff tools (`handoff_to_<agentId>`).
 *
 * The LLM provides a reason for the handoff and optional context to pass to the target agent.
 * This schema is validated via Zod before execution.
 *
 * Related: {@link HandoffResult} is the output, {@link generateHandoffTools} creates these tools.
 *
 * @docsCategory tools
 */
export interface HandoffToolInput {
  reason: string;
  context?: string;
}

/**
 * @description
 * Type guard that checks whether a tool execution result is a {@link HandoffResult} signal.
 *
 * Used by {@link AgentRuntime} after each tool execution to detect agent handoff requests.
 * Checks for the `__handoff: true` marker property.
 *
 * @param result - Tool execution result to check
 * @returns True if the result signals an agent handoff
 *
 * @docsCategory tools
 */
export function isHandoffResult(result: unknown): result is HandoffResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '__handoff' in result &&
    (result as HandoffResult).__handoff === true
  );
}
