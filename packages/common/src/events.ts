/**
 * @description
 * Discriminated union of all events emitted during a streaming conversation turn.
 *
 * Events flow from {@link AgentRuntime} through the transport layer ({@link SSETransport})
 * to the frontend, where {@link useAgent} processes them to update Jotai atoms. The `type`
 * field discriminates each event variant:
 *
 * - `message-start` / `text-delta` / `text-complete` — Message lifecycle
 * - `reasoning-delta` — Extended thinking content (when enabled)
 * - `tool-call-start` / `tool-call-args` / `tool-call-result` / `tool-call-error` — Tool execution
 * - `approval-required` — Human-in-the-loop gate for sensitive tools
 * - `agent-handoff` — Multi-agent routing transition
 * - `stream-complete` — Conversation turn finished
 * - `error` — Fatal error with optional error code
 *
 * Related: {@link AgentRuntime} emits these, {@link SSETransport} transports them,
 * {@link useAgent} consumes them, {@link AgentTransport} defines the transport contract.
 *
 * @docsCategory core-types
 */
export type RuntimeEvent =
  | { type: 'message-start'; messageId: string; agentId: string }
  | { type: 'text-delta'; messageId: string; delta: string }
  | { type: 'text-complete'; messageId: string; content: string }
  | { type: 'tool-call-start'; toolCallId: string; toolName: string; agentId: string }
  | { type: 'tool-call-args'; toolCallId: string; args: unknown }
  | { type: 'tool-call-result'; toolCallId: string; result: unknown }
  | { type: 'tool-call-error'; toolCallId: string; error: string; code?: string }
  | { type: 'reasoning-delta'; messageId: string; delta: string }
  | { type: 'agent-handoff'; fromAgent: string; toAgent: string; reason: string }
  | {
      type: 'approval-required';
      toolCallId: string;
      toolName: string;
      args: unknown;
      agentId: string;
    }
  | { type: 'stream-complete'; conversationId: string }
  | { type: 'error'; error: string; code?: string; category?: string };
