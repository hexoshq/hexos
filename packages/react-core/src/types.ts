import type { z } from 'zod';

// === Message Types ===

/**
 * @description
 * Frontend representation of a message in the conversation, with structured parts for rich rendering.
 *
 * Includes a `parts` array for granular rendering of tool calls, reasoning blocks, and images.
 * The `metadata` field allows attaching arbitrary data for custom rendering.
 *
 * Related: {@link MessagePart} defines part types, {@link messagesAtom} stores the array,
 * {@link MessageBubble} renders individual messages.
 *
 * @docsCategory core-types
 */
export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: Date;
  agentId?: string;
  metadata?: Record<string, unknown>;
  parts?: MessagePart[];
}

/**
 * @description
 * Discriminated union of structured content parts within an {@link AgentMessage}.
 *
 * Enables rich message rendering: text blocks, tool call/result pairs, reasoning
 * (extended thinking), and inline images. The `type` field discriminates each variant.
 *
 * Related: {@link ToolCallState} tracks tool execution progress,
 * {@link MessageBubble} renders parts, {@link ReasoningDisplay} shows reasoning blocks.
 *
 * @docsCategory core-types
 */
export type MessagePart =
  | { type: 'text'; content: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown; state: ToolCallState }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'reasoning'; content: string; isVisible: boolean }
  | { type: 'image'; url: string; alt?: string };

/**
 * @description
 * Lifecycle state of a tool call on the frontend.
 *
 * Tracks tool execution through: `pending` (waiting to start), `executing` (in progress),
 * `awaiting-approval` (blocked on user decision), `completed` (finished successfully),
 * or `failed` (execution error). Used by {@link ToolCallRenderer} for visual state.
 *
 * @docsCategory core-types
 */
export type ToolCallState = 'pending' | 'executing' | 'awaiting-approval' | 'completed' | 'failed';

// === Configuration ===

/**
 * @description
 * Frontend configuration for connecting to an Hexos backend and customizing behavior.
 *
 * Extends the base config with frontend-specific options: an `approvalEndpoint` for
 * human-in-the-loop flows (defaults to `endpoint + '/approve'`), a `systemMessage`
 * for client-side prompt, and an `onToolApprovalRequired` callback for programmatic
 * approval handling.
 *
 * The `headers` field supports both static objects and async functions for dynamic
 * authentication (e.g., refreshing JWT tokens before each request).
 *
 * Related: {@link useAgent} accepts this config, {@link SSETransport} uses it for connections,
 * {@link AgentProvider} initializes atoms from this config.
 *
 * @docsCategory transport
 */
export interface AgentConfig {
  endpoint: string;
  /** Endpoint for sending approval decisions (defaults to endpoint + '/approve') */
  approvalEndpoint?: string;
  agents?: string[];
  transport?: 'sse' | 'websocket' | 'fetch';
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  conversationId?: string;
  systemMessage?: string;
  enableReasoning?: boolean;
  onToolApprovalRequired?: (request: ToolApprovalRequest) => Promise<boolean>;
}

// === Tool Types ===

/**
 * @description
 * Represents a pending tool approval request on the frontend.
 *
 * Created when an `approval-required` {@link TransportEvent} arrives from the server.
 * Contains the tool call metadata needed to display an approval dialog to the user.
 *
 * Related: {@link useToolApproval} manages these requests, {@link ToolApprovalDialog}
 * renders the approval UI, {@link ApprovalDecision} is the user's response.
 *
 * @docsCategory tools
 */
export interface ToolApprovalRequest {
  toolCallId: string;
  toolName: string;
  args: unknown;
  agentId: string;
  timestamp: Date;
}

/**
 * @description
 * Defines a tool that executes in the browser rather than on the server.
 *
 * Frontend tools have access to browser APIs (clipboard, geolocation, DOM, etc.)
 * and execute locally when the agent invokes them. The optional `render` function
 * provides custom UI for displaying the tool's input and output.
 *
 * When the LLM calls a frontend tool, {@link useAgent} detects the matching name in
 * {@link frontendToolsAtom} and executes it locally instead of waiting for a server result.
 *
 * Related: {@link useAgentTool} registers these tools, {@link ToolDefinition} is the
 * server-side equivalent.
 *
 * @docsCategory tools
 */
export interface FrontendToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  requiresApproval?: boolean;
  execute?: (input: TInput) => Promise<TOutput>;
  render?: (props: { input: TInput; output?: TOutput; state: ToolCallState }) => React.ReactNode;
}

// === Context Types ===

/**
 * @description
 * Defines a context entry that is sent with every agent request.
 *
 * Context entries provide the agent with information about the current application state
 * (e.g., current page, user preferences, selected items). The `persistent` flag controls
 * whether the context survives component unmounting (default: true).
 *
 * Related: {@link useAgentContext} registers context, {@link frontendContextAtom} stores it,
 * {@link ToolContext}.frontendContext receives it on the server.
 *
 * @docsCategory hooks
 */
export interface ContextDefinition {
  key: string;
  description: string;
  value: unknown;
  persistent?: boolean;
  priority?: number;
}

// === Action Types ===

/**
 * @description
 * Defines a frontend action that the agent can trigger, with optimistic update support.
 *
 * Actions are like {@link FrontendToolDefinition} but designed for state mutations.
 * They support optimistic updates (apply changes immediately before the async handler
 * resolves) and automatic rollback on errors. An optional `confirmationMessage` triggers
 * a confirmation dialog before execution.
 *
 * Related: {@link useAgentAction} registers and executes actions,
 * {@link ActionConfirmDialog} renders confirmation UI.
 *
 * @docsCategory hooks
 */
export interface ActionDefinition<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput) => Promise<void>;
  confirmationMessage?: string | ((input: TInput) => string);
  optimisticUpdate?: (input: TInput) => void;
  rollback?: (input: TInput, error: Error) => void;
}

/**
 * @description
 * Tracks the execution state of an action for global observability.
 *
 * Stored in {@link executingActionsAtom} and updated by {@link useAgentAction}.
 *
 * @docsCategory state-management
 */
export interface ActionExecutionState {
  id: string;
  name: string;
  args: unknown;
  status: 'executing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

/**
 * @description
 * Return type of the {@link useAgentAction} hook, providing execution controls and state.
 *
 * @docsCategory hooks
 */
export interface UseAgentActionReturn<TInput> {
  /** Execute the action manually */
  execute: (input: TInput) => Promise<void>;
  /** Whether an execution is in progress */
  isExecuting: boolean;
  /** Last execution error */
  error: Error | null;
  /** Last execution result */
  lastResult: unknown;
  /** Clear the error state */
  clearError: () => void;
}

/**
 * @description
 * Represents a pending action confirmation waiting for user decision.
 *
 * Created when an action with `confirmationMessage` is triggered. The `resolve`
 * function is called with the user's decision (true to confirm, false to cancel).
 *
 * Related: {@link ActionConfirmDialog} renders the confirmation UI,
 * {@link pendingActionConfirmationsAtom} stores these entries.
 *
 * @docsCategory state-management
 */
export interface PendingActionConfirmation {
  id: string;
  actionName: string;
  args: unknown;
  message: string;
  resolve: (confirmed: boolean) => void;
}

// === Transport Types ===

/**
 * @description
 * Message payload sent from the frontend client to the backend via the transport layer.
 *
 * Related: {@link AgentTransport} defines the send contract,
 * {@link RuntimeInput} is the server-side equivalent.
 *
 * @docsCategory transport
 */
export interface TransportMessage {
  type: 'send-message';
  message: string;
  conversationId: string;
  context?: Record<string, unknown>;
}

/**
 * @description
 * Discriminated union of events received from the server via the transport layer.
 *
 * Mirrors the {@link RuntimeEvent} type from `@hexos/common`. Processed by {@link useAgent}
 * to update Jotai atoms as streaming events arrive.
 *
 * @docsCategory transport
 */
export type TransportEvent =
  | { type: 'message-start'; messageId: string; agentId: string }
  | { type: 'text-delta'; messageId: string; delta: string }
  | { type: 'text-complete'; messageId: string; content: string }
  | { type: 'tool-call-start'; toolCallId: string; toolName: string; agentId: string }
  | { type: 'tool-call-args'; toolCallId: string; args: unknown }
  | { type: 'tool-call-result'; toolCallId: string; result: unknown }
  | { type: 'tool-call-error'; toolCallId: string; error: string }
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
  | { type: 'error'; error: string; code?: string };

/**
 * @description
 * User's response to a tool approval request — approve or reject with optional reason.
 *
 * Sent via {@link SSETransport}.sendApproval() to the approval endpoint.
 *
 * Related: {@link ToolApprovalRequest} is the request, {@link useToolApproval} sends decisions.
 *
 * @docsCategory tools
 */
export interface ApprovalDecision {
  toolCallId: string;
  approved: boolean;
  reason?: string;
}

/**
 * @description
 * Abstract transport interface for client-server communication.
 *
 * {@link SSETransport} is the default implementation using HTTP Server-Sent Events.
 *
 * Related: {@link AgentConfig} configures the connection, {@link TransportMessage} is
 * the outbound payload, {@link TransportEvent} is the inbound event type.
 *
 * @docsCategory transport
 */
export interface AgentTransport {
  connect(config: AgentConfig): Promise<void>;
  send(message: TransportMessage): void;
  sendApproval(decision: ApprovalDecision): Promise<void>;
  onMessage(callback: (event: TransportEvent) => void): () => void;
  disconnect(): void;
}

// === Attachment Types ===

/**
 * @description
 * File or image attachment associated with a message.
 *
 * Supports file and image types with either a URL reference or base64-encoded data.
 *
 * @docsCategory core-types
 */
export interface Attachment {
  type: 'file' | 'image';
  name: string;
  url?: string;
  data?: string; // base64
  mimeType?: string;
}
