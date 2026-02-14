/**
 * @packageDocumentation
 * @hexos/common — Shared types, interfaces, enums, and utilities for the Hexos framework.
 *
 * This package provides the foundational type contracts used across all Hexos packages:
 * frontend (react-core, react-ui) and backend (runtime). It defines the shapes for
 * agents, tools, messages, events, MCP integration, and transport communication.
 */

// === LLM Providers ===

/**
 * @description
 * Enumerates the supported LLM provider backends.
 *
 * Used in {@link ModelConfig} to select which provider handles LLM calls.
 * Each provider has a corresponding client factory and streaming implementation
 * in the `@hexos/runtime` package.
 *
 * @docsCategory core-types
 */
export enum LLMProvider {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Ollama = 'ollama',
  Google = 'google',
  Azure = 'azure',
}

/**
 * @description
 * Available OpenAI model identifiers for use with {@link LLMProvider.OpenAI}.
 *
 * These values map directly to the OpenAI API `model` parameter. Select a model
 * based on capability and cost tradeoffs for your use case.
 *
 * @docsCategory core-types
 */
export enum OpenAIModel {
  GPT4o = 'gpt-4o',
  GPT4oMini = 'gpt-4o-mini',
  GPT4Turbo = 'gpt-4-turbo',
  GPT4 = 'gpt-4',
  GPT35Turbo = 'gpt-3.5-turbo',
}

/**
 * @description
 * Available Anthropic model identifiers for use with {@link LLMProvider.Anthropic}.
 *
 * These values map directly to the Anthropic API `model` parameter.
 *
 * @docsCategory core-types
 */
export enum AnthropicModel {
  Claude4Sonnet = 'claude-sonnet-4-20250514',
  Claude37Sonnet = 'claude-3-7-sonnet-20250219',
  Claude3Opus = 'claude-3-opus-20240229',
  Claude3Sonnet = 'claude-3-sonnet-20240229',
  Claude3Haiku = 'claude-3-haiku-20240307',
}

/**
 * @description
 * Available Ollama model identifiers for use with {@link LLMProvider.Ollama}.
 *
 * These values map to locally-hosted models via the Ollama runtime.
 * Custom models can also be specified as a plain string in {@link ModelConfig}.
 *
 * @docsCategory core-types
 */
export enum OllamaModel {
  Llama3 = 'llama3',
  Llama31 = 'llama3.1',
  Llama32 = 'llama3.2',
  Mistral = 'mistral',
  Mixtral = 'mixtral',
  CodeLlama = 'codellama',
  Phi = 'phi',
  Gemma = 'gemma',
  Qwen = 'qwen',
}

// === Model Configuration ===

/**
 * @description
 * Configuration for an LLM provider connection, specifying which model to use and how to connect.
 *
 * Each {@link AgentDefinition} requires a ModelConfig to determine its LLM backend.
 * The `apiKey` field supports both static strings and async functions for dynamic
 * key retrieval (e.g., from a secrets manager). The `baseUrl` field enables custom
 * endpoints for proxies or self-hosted providers.
 *
 * Related: {@link LLMProvider} determines the provider, {@link AgentDefinition} uses this config.
 *
 * @docsCategory agent-config
 */
export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string | (() => Promise<string>);
  baseUrl?: string;
}

// === Tool Types ===

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

// === Agent Types ===

/**
 * @description
 * Context available to agents during conversation execution, including conversation
 * metadata and client-provided data.
 *
 * Passed to dynamic system prompts (when `systemPrompt` is a function) and to
 * {@link RuntimeHooks} lifecycle callbacks. The `frontendContext` field contains
 * arbitrary data sent by the client with each request.
 *
 * Related: {@link AgentDefinition} uses this for dynamic system prompts,
 * {@link ToolContext} carries a subset of this context to tools.
 *
 * @docsCategory agent-config
 */
export interface AgentContext {
  conversationId: string;
  userId?: string;
  frontendContext: Record<string, unknown>;
}

/**
 * @description
 * Complete specification for an AI agent, defining its identity, LLM backend, tools, and routing.
 *
 * Each agent has a unique ID, a display name, an LLM configuration ({@link ModelConfig}), and a
 * system prompt that can be static or dynamic (receiving {@link AgentContext}). Agents declare
 * their available tools and can optionally access MCP servers and hand off to other agents.
 *
 * The `canHandoffTo` field enables the multi-agent swarm pattern: the runtime auto-generates
 * `handoff_to_<agentId>` tools for each target agent, allowing the LLM to route conversations.
 * The `maxIterations` field provides a safety limit on tool-call loops per turn.
 *
 * Related: {@link RuntimeConfig} collects agents, {@link AgentRuntime} orchestrates them,
 * {@link ModelConfig} configures the LLM, {@link ToolDefinition} defines available tools.
 *
 * @docsCategory agent-config
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  model: ModelConfig;
  systemPrompt: string | ((context: AgentContext) => string);
  tools: ToolDefinition[];
  /** MCP servers this agent can use */
  allowedMcpServers?: string[];
  canHandoffTo?: string[];
  maxIterations?: number;
}

// === Message Types ===

/**
 * @description
 * Discriminator for message authorship in a conversation.
 *
 * Used by {@link AgentMessage} to identify who produced a message:
 * `user` for human input, `assistant` for LLM responses, `system` for
 * system prompts, and `tool` for tool execution results.
 *
 * @docsCategory core-types
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * @description
 * Represents a single message in a conversation, with role, content, and optional structured data.
 *
 * Messages are the primary data unit in the chat flow. User messages contain plain text input,
 * while assistant messages may include tool calls and their results. Each message is timestamped
 * and optionally tagged with the agent that produced it for multi-agent conversations.
 *
 * Related: {@link MessageRole} discriminates authorship, {@link ToolCall} tracks tool invocations,
 * {@link Attachment} holds file/media data.
 *
 * @docsCategory core-types
 */
export interface AgentMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  agentId?: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
}

/**
 * @description
 * Tracks a single tool invocation from the LLM, including its lifecycle state and result.
 *
 * Created when the LLM requests tool execution. The `status` field tracks the call through
 * its lifecycle: `pending` → `running` → `completed` or `error`. Results and errors are
 * populated once execution finishes.
 *
 * Related: {@link ToolDefinition} defines the callable tool, {@link RuntimeEvent} streams
 * tool call progress, {@link ToolCallRenderer} displays execution in the UI.
 *
 * @docsCategory tools
 */
export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

/**
 * @description
 * File or media attachment associated with a message.
 *
 * Supports image, file, and audio types. The `data` field contains the content
 * as a base64 string or data URI. Attachments are sent with user messages via
 * {@link TransportMessage} and stored in {@link AgentMessage}.
 *
 * @docsCategory core-types
 */
export interface Attachment {
  type: 'image' | 'file' | 'audio';
  name: string;
  data: string;
  mimeType: string;
}

// === Runtime Events ===

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
  | { type: 'error'; error: string; code?: string };

// === Runtime Configuration ===

/**
 * @description
 * Lifecycle callbacks invoked at key points during agent execution.
 *
 * Hooks enable observability and side effects without modifying core runtime behavior.
 * All hooks are optional and can be synchronous or async. They are called by
 * {@link AgentRuntime} during conversation streaming.
 *
 * Related: {@link RuntimeConfig} registers hooks, {@link AgentContext} is passed to agent hooks.
 *
 * @docsCategory agent-config
 */
export interface RuntimeHooks {
  onAgentStart?: (agentId: string, context: AgentContext) => void | Promise<void>;
  onAgentEnd?: (agentId: string, context: AgentContext) => void | Promise<void>;
  onToolCall?: (toolName: string, args: unknown) => void | Promise<void>;
  onToolResult?: (toolName: string, result: unknown) => void | Promise<void>;
  onHandoff?: (from: string, to: string, reason: string) => void | Promise<void>;
  onError?: (error: Error, context: AgentContext) => void | Promise<void>;
}

// === MCP Server Types ===

/**
 * @description
 * Discriminator for MCP server transport protocols.
 *
 * MCP servers can communicate via `stdio` (local process) or `sse` (HTTP Server-Sent Events).
 * Used by {@link MCPServerConfig} to determine the transport type.
 *
 * @docsCategory mcp
 */
export type MCPTransportType = 'stdio' | 'sse';

/**
 * @description
 * Base configuration shared by all MCP server transport types.
 *
 * Provides common settings for lazy initialization, debug logging, and request timeouts.
 * Lazy servers are not connected at runtime startup — they initialize on first use,
 * reducing startup time when some MCP servers are rarely needed.
 *
 * Related: {@link MCPStdioServerConfig} and {@link MCPSSEServerConfig} extend this base.
 *
 * @docsCategory mcp
 */
export interface MCPServerConfigBase {
  /** Lazy start - only connect when needed */
  lazy?: boolean;
  /** Enable debug logging for this MCP server */
  debug?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeoutMs?: number;
}

/**
 * @description
 * Configuration for an MCP server communicating via stdio (local child process).
 *
 * The runtime spawns the server as a child process using the specified command and arguments.
 * Communication uses JSON-RPC 2.0 over stdin/stdout pipes. Suitable for locally-installed
 * MCP tools like filesystem access or database queries.
 *
 * Related: {@link MCPServerConfigBase} provides shared settings,
 * {@link MCPSSEServerConfig} is the alternative for remote servers.
 *
 * @docsCategory mcp
 */
export interface MCPStdioServerConfig extends MCPServerConfigBase {
  /** Transport type - defaults to 'stdio' for backward compatibility */
  transport?: 'stdio';
  /** Command to start the MCP server */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * @description
 * Configuration for an MCP server communicating via HTTP Server-Sent Events.
 *
 * Connects to a remote MCP server over HTTP. Supports custom headers for authentication
 * (e.g., Bearer tokens). Suitable for shared or cloud-hosted MCP servers.
 *
 * Related: {@link MCPServerConfigBase} provides shared settings,
 * {@link MCPStdioServerConfig} is the alternative for local servers.
 *
 * @docsCategory mcp
 */
export interface MCPSSEServerConfig extends MCPServerConfigBase {
  /** Transport type */
  transport: 'sse';
  /** URL of the MCP SSE server endpoint (e.g., 'http://localhost:3001/mcp/sse') */
  url: string;
  /** Optional headers for authentication */
  headers?: Record<string, string>;
  /** Legacy alias for requestTimeoutMs (default: 30000) */
  timeout?: number;
}

/**
 * @description
 * Union type for MCP server configurations, supporting both STDIO and SSE transports.
 *
 * Use {@link isMCPSSEConfig} and {@link isMCPStdioConfig} type guards to narrow the type.
 *
 * @docsCategory mcp
 */
export type MCPServerConfig = MCPStdioServerConfig | MCPSSEServerConfig;

/**
 * @description
 * Type guard that narrows {@link MCPServerConfig} to {@link MCPSSEServerConfig}.
 *
 * @param config - MCP server configuration to check
 * @returns True if the configuration uses SSE transport
 *
 * @docsCategory mcp
 */
export function isMCPSSEConfig(config: MCPServerConfig): config is MCPSSEServerConfig {
  return config.transport === 'sse';
}

/**
 * @description
 * Type guard that narrows {@link MCPServerConfig} to {@link MCPStdioServerConfig}.
 *
 * Defaults to STDIO when no transport is specified, maintaining backward compatibility.
 *
 * @param config - MCP server configuration to check
 * @returns True if the configuration uses STDIO transport (or has no transport specified)
 *
 * @docsCategory mcp
 */
export function isMCPStdioConfig(config: MCPServerConfig): config is MCPStdioServerConfig {
  return !config.transport || config.transport === 'stdio';
}

/**
 * @description
 * Metadata for a tool discovered from an MCP server.
 *
 * Contains the tool name, optional description, and its JSON Schema input definition.
 * Retrieved by {@link MCPManager} during server initialization and cached for reuse.
 *
 * Related: {@link MCPServerConfig} configures the server, {@link ToolDefinition} is the
 * runtime-native equivalent.
 *
 * @docsCategory mcp
 */
export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: unknown; // JSON Schema
}

/**
 * @description
 * Configuration for in-memory request rate limiting.
 *
 * Controls how many requests a user or conversation can make within a sliding time window.
 * The `scope` field determines the rate limit key: per user, per conversation, or the
 * more restrictive of both.
 *
 * Related: {@link RuntimeConfig} applies this to the runtime,
 * {@link SlidingWindowRateLimiter} implements the algorithm.
 *
 * @docsCategory infrastructure
 */
export interface RateLimitConfig {
  enabled?: boolean;
  scope?: 'user' | 'conversation' | 'user-or-conversation';
  windowMs?: number;
  maxRequests?: number;
}

/**
 * @description
 * Configuration for exponential backoff retry on transient infrastructure failures.
 *
 * Applied to LLM API calls and MCP server connections. Uses exponential backoff with
 * optional jitter to prevent thundering herd effects. The delay between retries grows
 * as `initialDelayMs * multiplier^attempt`, capped at `maxDelayMs`.
 *
 * Related: {@link RuntimeConfig} applies this to the runtime.
 *
 * @docsCategory infrastructure
 */
export interface RetryConfig {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  multiplier?: number;
  jitter?: boolean;
}

/**
 * @description
 * Master configuration for the Hexos runtime, defining agents, tools, MCP servers, and operational limits.
 *
 * This is the primary input to {@link AgentRuntime}. It registers all agents and their tools,
 * configures MCP server connections, sets lifecycle hooks, and defines resource limits for
 * concurrency, rate limiting, timeouts, and approval management.
 *
 * The runtime normalizes this config at startup, applying defaults for all optional numeric
 * fields and validating relationships between values.
 *
 * Related: {@link AgentDefinition} defines individual agents, {@link ToolDefinition} defines tools,
 * {@link MCPServerConfig} configures MCP servers, {@link RuntimeHooks} provides lifecycle callbacks,
 * {@link RateLimitConfig} and {@link RetryConfig} control resilience.
 *
 * @docsCategory agent-config
 */
export interface RuntimeConfig {
  agents: AgentDefinition[];
  defaultAgent?: string;
  globalTools?: ToolDefinition[];
  /** MCP server configurations */
  mcpServers?: Record<string, MCPServerConfig>;
  hooks?: RuntimeHooks;
  debug?: boolean;
  /** Maximum number of agent handoffs per conversation (default: 10) */
  maxHandoffs?: number;
  /** Max time to wait for user approval before auto-rejecting (default: 300000) */
  approvalTimeoutMs?: number;
  /** Max pending approvals per conversation (default: 20) */
  maxPendingApprovalsPerConversation?: number;
  /** Default timeout for tool execution in milliseconds (default: 60000) */
  defaultToolTimeoutMs?: number;
  /** Max active streams across all conversations (default: 100) */
  maxActiveStreams?: number;
  /** Max active streams per conversation (default: 1) */
  maxActiveStreamsPerConversation?: number;
  /** Max concurrent tool executions across runtime (default: 8) */
  maxConcurrentToolExecutions?: number;
  /** Max time to wait in tool execution queue in milliseconds (default: 10000) */
  toolExecutionQueueTimeoutMs?: number;
  /** In-memory request rate limiting config */
  rateLimit?: RateLimitConfig;
  /** Retry policy for transient infrastructure failures */
  retry?: RetryConfig;
}

// === Runtime Input/Output ===

/**
 * @description
 * Input payload for a conversation turn, containing the user message and context.
 *
 * Passed to {@link AgentRuntime}.stream() or invoke() to initiate a conversation turn.
 * The `context` field carries arbitrary frontend data that becomes available to tools
 * via {@link ToolContext}.frontendContext.
 *
 * Related: {@link RuntimeOutput} is the non-streaming response,
 * {@link RuntimeEvent} is the streaming response.
 *
 * @docsCategory runtime
 */
export interface RuntimeInput {
  message: string;
  conversationId: string;
  context?: Record<string, unknown>;
  userId?: string;
}

/**
 * @description
 * Non-streaming response from a conversation turn via {@link AgentRuntime}.invoke().
 *
 * Contains the final response text, the agent that handled the request, and a summary
 * of all tool calls executed during the turn with their durations.
 *
 * Related: {@link RuntimeInput} is the input, {@link ToolCallResult} details each tool execution.
 *
 * @docsCategory runtime
 */
export interface RuntimeOutput {
  response: string;
  activeAgent: string;
  toolCalls?: ToolCallResult[];
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

// === Tool Approval ===

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

// === Handoff ===

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

// === Frontend Types ===

/**
 * @description
 * Frontend configuration for connecting to an Hexos backend endpoint.
 *
 * Passed to {@link useAgent} hook or {@link AgentProvider} to establish the client-server
 * connection. The `headers` field supports both static objects and async functions for
 * dynamic authentication (e.g., refreshing JWT tokens before each request).
 *
 * The `enableReasoning` flag requests extended thinking content from the LLM, which
 * arrives as `reasoning-delta` {@link RuntimeEvent}s.
 *
 * Related: {@link SSETransport} uses this to connect, {@link useAgent} accepts this as input,
 * {@link AgentProvider} can initialize with this config.
 *
 * @docsCategory transport
 */
export interface AgentConfig {
  endpoint: string;
  agents?: string[];
  transport?: 'sse' | 'websocket';
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  conversationId?: string;
  enableReasoning?: boolean;
}

/**
 * @description
 * Alias for {@link RuntimeEvent}, used on the frontend to represent events received from the transport layer.
 *
 * @docsCategory transport
 */
export type TransportEvent = RuntimeEvent;

/**
 * @description
 * Message payload sent from the frontend client to the backend via the transport layer.
 *
 * Contains the user's message text, conversation ID, optional frontend context, and
 * file attachments. Sent by {@link SSETransport}.send() as the HTTP request body.
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
  attachments?: Attachment[];
}

/**
 * @description
 * Abstract transport interface for client-server communication in Hexos.
 *
 * Defines the contract for connecting to a backend, sending messages, receiving events,
 * and disconnecting. {@link SSETransport} is the default implementation using HTTP
 * Server-Sent Events. Future implementations could support WebSockets or other protocols.
 *
 * Related: {@link SSETransport} implements this interface, {@link AgentConfig} configures
 * the connection, {@link TransportMessage} is the outbound payload,
 * {@link TransportEvent} is the inbound event type.
 *
 * @docsCategory transport
 */
export interface AgentTransport {
  connect(config: AgentConfig): Promise<void>;
  send(message: TransportMessage): void;
  onMessage(callback: (event: TransportEvent) => void): () => void;
  disconnect(): void;
}
