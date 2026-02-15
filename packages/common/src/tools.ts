/**
 * @description
 * Execution context passed to every tool invocation, carrying conversation and agent metadata.
 *
 * Provides identifiers for the active agent, conversation, and optional user. The `frontendContext`
 * field carries arbitrary client-side data sent with each request, enabling per-client behavior
 * such as dynamic approval requirements or environment-specific logic.
 *
 * Related: {@link ToolDefinition} receives this during execution,
 * {@link AgentRuntime} builds this from {@link RuntimeInput}.
 *
 * @docsCategory tools
 */
export interface ToolContext {
  agentId: string;
  conversationId: string;
  userId?: string;
  /** Frontend context passed from the client (includes client config, etc.) */
  frontendContext?: Record<string, unknown>;
}

/**
 * @description
 * Defines the contract for tools that AI agents can invoke during conversation flows.
 *
 * Tools extend agent capabilities with custom logic. Each tool requires a name, description
 * (shown to the LLM), and a Zod input schema for validation. The `execute` function receives
 * validated input and a {@link ToolContext} with conversation metadata.
 *
 * Tools can require user approval before execution via `requiresApproval`. When set, the runtime
 * emits an `approval-required` {@link RuntimeEvent} and waits for an {@link ApprovalDecision}.
 * The flag supports both static booleans and dynamic functions for per-client configuration.
 *
 * Related: {@link AgentDefinition} registers tools, {@link AgentRuntime} executes them,
 * {@link useAgentTool} registers frontend-side tools.
 *
 * @docsCategory tools
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: unknown; // Zod schema
  outputSchema?: unknown; // Zod schema
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
  /**
   * Whether this tool requires user approval before execution.
   * Can be a boolean or a function that receives the tool context and returns a boolean.
   * Use a function for per-client configuration:
   * @example
   * requiresApproval: (context) => context.frontendContext?.requireToolApproval ?? true
   */
  requiresApproval?: boolean | ((context: ToolContext) => boolean);
  timeout?: number;
}

/**
 * @description
 * Represents a pending tool approval request waiting for user decision.
 *
 * Created when a tool with `requiresApproval` is invoked. The runtime holds execution
 * until an {@link ApprovalDecision} is submitted. Includes the tool name, arguments,
 * and the agent that requested execution.
 *
 * Related: {@link ApprovalDecision} resolves the request, {@link ToolDefinition}.requiresApproval
 * triggers this flow, {@link useToolApproval} manages the frontend UI.
 *
 * @docsCategory tools
 */
export interface ToolApproval {
  toolCallId: string;
  toolName: string;
  args: unknown;
  agentId: string;
  timestamp: Date;
}

/**
 * @description
 * User's response to a {@link ToolApproval} request — approve or reject with optional reason.
 *
 * Submitted via {@link AgentRuntime}.submitApproval() on the backend, or via
 * {@link useToolApproval}.approve() / reject() on the frontend. When rejected,
 * the tool call fails with the provided reason.
 *
 * Related: {@link ToolApproval} is the request, {@link ToolApprovalDialog} renders the UI.
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
 * Summary of a completed tool execution, including timing information.
 *
 * Returned as part of {@link RuntimeOutput} after a non-streaming conversation turn.
 * The `duration` field measures execution time in milliseconds, useful for performance monitoring.
 *
 * Related: {@link ToolCall} is the in-flight representation, {@link ToolDefinition} defines the tool.
 *
 * @docsCategory runtime
 */
export interface ToolCallResult {
  toolName: string;
  args: unknown;
  result: unknown;
  duration: number;
}
