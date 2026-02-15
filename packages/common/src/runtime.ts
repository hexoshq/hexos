import type { AgentContext, AgentDefinition } from './agents.js';
import type { MCPServerConfig } from './mcp.js';
import type { ToolCallResult, ToolDefinition } from './tools.js';

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
