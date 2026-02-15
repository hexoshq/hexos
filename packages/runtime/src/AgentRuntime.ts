import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { Ollama } from 'ollama';
import {
  LLMProvider,
  isHandoffResult,
  type RuntimeConfig,
  type RuntimeInput,
  type RuntimeOutput,
  type RuntimeEvent,
  type AgentDefinition,
  type ApprovalDecision,
  type ToolDefinition,
  type ToolContext,
  type HandoffResult,
} from '@hexos/common';
import { generateHandoffTools } from './tools/handoff.js';
import { MCPManager, type MCPToolWithServer } from './mcp/index.js';
import {
  createAnthropicClient,
  convertToolsToAnthropicFormat as convertToolsToAnthropicFormatProvider,
  streamWithAnthropicProvider,
} from './providers/anthropic/index.js';
import {
  createOllamaClient,
  convertToolsToOllamaFormat as convertToolsToOllamaFormatProvider,
  streamWithOllamaProvider,
} from './providers/ollama/index.js';
import {
  createOpenAIClient,
  convertToolsToOpenAIFormat as convertToolsToOpenAIFormatProvider,
  streamWithOpenAIProvider,
} from './providers/openai/index.js';
import { zodToJsonSchema as zodToJsonSchemaProvider } from './providers/shared/zodToJsonSchema.js';
import type { ProviderDependencies } from './providers/shared/types.js';
import { retryWithBackoff, isRetryableError } from './utils/retry.js';
import { withTimeout } from './utils/timeout.js';
import { Semaphore } from './utils/semaphore.js';
import { SlidingWindowRateLimiter } from './utils/rateLimiter.js';
import { normalizeRuntimeConfig, type NormalizedRuntimeConfig } from './utils/config.js';
import { sanitizeError, ErrorCategory } from './utils/errorSanitizer.js';

const ERROR_CODES = {
  MAX_HANDOFFS_EXCEEDED: 'MAX_HANDOFFS_EXCEEDED',
  MAX_ITERATIONS_EXCEEDED: 'MAX_ITERATIONS_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  MAX_ACTIVE_STREAMS_EXCEEDED: 'MAX_ACTIVE_STREAMS_EXCEEDED',
  CONVERSATION_BUSY: 'CONVERSATION_BUSY',
  TOOL_QUEUE_TIMEOUT: 'TOOL_QUEUE_TIMEOUT',
  TOOL_TIMEOUT: 'TOOL_TIMEOUT',
  APPROVAL_TIMEOUT: 'APPROVAL_TIMEOUT',
  MAX_PENDING_APPROVALS_EXCEEDED: 'MAX_PENDING_APPROVALS_EXCEEDED',
  MCP_TIMEOUT: 'MCP_TIMEOUT',
} as const;

type RuntimeErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES] | 'NO_APPROVALS_APPLIED';

/**
 * Extended RuntimeEvent that includes optional error category.
 * The `category` field on error events allows frontends to classify
 * and display errors appropriately (auth, rate_limit, network, etc.).
 */
type RuntimeEventWithCategory = RuntimeEvent | {
  type: 'error';
  error: string;
  code?: string;
  category?: ErrorCategory;
};

interface ApprovalDecisionInternal extends ApprovalDecision {
  code?: RuntimeErrorCode;
}

/** Pending approval state for a conversation */
interface PendingApproval {
  conversationId: string;
  toolCallId: string;
  toolName: string;
  toolDef: ToolDefinition;
  args: unknown;
  agentId: string;
  resolve: (decision: ApprovalDecisionInternal) => void;
  timer?: ReturnType<typeof setTimeout>;
}

interface StreamSlot {
  release: () => void;
  errorEvent?: RuntimeEventWithCategory;
}

/**
 * @description
 * Central orchestrator for multi-agent conversations with LLM providers, tool execution,
 * and human-in-the-loop approvals.
 *
 * AgentRuntime manages the complete lifecycle of agent interactions: routing messages to
 * the appropriate LLM provider ({@link LLMProvider}), executing tools with concurrency
 * limits ({@link Semaphore}) and timeouts ({@link withTimeout}), coordinating agent handoffs
 * via the swarm pattern ({@link generateHandoffTools}), and managing pending approval
 * workflows ({@link ToolApproval}).
 *
 * The runtime operates in streaming mode via `stream()`, yielding {@link RuntimeEvent} objects
 * as the conversation progresses. It enforces resource limits: max concurrent streams,
 * rate limiting ({@link SlidingWindowRateLimiter}), tool execution concurrency, and approval
 * timeouts. Configuration is validated and normalized at construction via {@link normalizeRuntimeConfig}.
 *
 * Typical flow:
 * 1. Client calls `stream(input)` with user message
 * 2. Runtime selects active agent and builds tool list (local + handoff + MCP)
 * 3. LLM provider streams response, emitting text-delta and tool-call events
 * 4. Tools execute with approval checks and guards
 * 5. Handoff tools trigger agent switches, continuing the loop
 * 6. Stream completes with final message content
 *
 * Related: {@link RuntimeConfig} configures the runtime, {@link RuntimeEvent} is the event output,
 * {@link SSETransport} consumes events on the frontend, {@link createAgentHandler} wraps this
 * for Next.js, {@link MCPManager} provides external tool integration.
 *
 * @docsCategory agent-runtime
 */
export class AgentRuntime {
  private agents: Map<string, AgentDefinition>;
  private defaultAgent: string;
  private config: NormalizedRuntimeConfig;
  private anthropic: Anthropic;
  private openai: OpenAI;
  private ollama: Ollama;
  private mcpManager: MCPManager | null = null;
  private mcpInitialized = false;

  /** Map of pending approvals by toolCallId */
  private pendingApprovals: Map<string, PendingApproval> = new Map();

  /** Stream concurrency guards */
  private activeStreams = 0;
  private activeStreamsByConversation = new Map<string, number>();

  /** Tool execution concurrency guard */
  private readonly toolExecutionSemaphore: Semaphore;

  /** Optional in-memory rate limiter */
  private readonly rateLimiter: SlidingWindowRateLimiter | null;

  constructor(config: RuntimeConfig) {
    this.config = normalizeRuntimeConfig(config);
    this.agents = new Map(this.config.agents.map((a) => [a.id, a]));
    this.defaultAgent = this.config.defaultAgent ?? this.config.agents[0]?.id ?? 'main';

    // Initialize clients
    this.anthropic = createAnthropicClient();
    this.openai = createOpenAIClient();
    this.ollama = createOllamaClient();

    this.toolExecutionSemaphore = new Semaphore(this.config.maxConcurrentToolExecutions);
    this.rateLimiter = this.config.rateLimit.enabled
      ? new SlidingWindowRateLimiter(this.config.rateLimit.windowMs, this.config.rateLimit.maxRequests)
      : null;

    // Initialize MCP manager if servers configured
    if (this.config.mcpServers && Object.keys(this.config.mcpServers).length > 0) {
      this.mcpManager = new MCPManager(this.config.mcpServers, { retry: this.config.retry });
    }
  }

  /**
   * @description
   * Initializes the runtime by connecting to configured MCP servers.
   *
   * Must be called before `stream()` or `invoke()`. Connects to non-lazy MCP servers
   * and caches their tool lists. Idempotent — subsequent calls are no-ops.
   *
   * Related: {@link MCPManager}.initialize() handles server connections.
   */
  async initialize(): Promise<void> {
    if (this.mcpInitialized) {
      return;
    }

    if (this.mcpManager) {
      await this.mcpManager.initialize();
    }

    this.mcpInitialized = true;
  }

  /**
   * @description
   * Shuts down the runtime by disconnecting all MCP servers.
   *
   * Call this during application teardown to clean up child processes and connections.
   */
  async shutdown(): Promise<void> {
    if (this.mcpManager) {
      await this.mcpManager.shutdown();
    }
    this.mcpInitialized = false;
  }

  private waitForApproval(
    conversationId: string,
    toolCallId: string,
    toolName: string,
    toolDef: ToolDefinition,
    args: unknown,
    agentId: string
  ): Promise<ApprovalDecisionInternal> {
    const pendingForConversation = this.getPendingApprovals(conversationId).length;
    if (pendingForConversation >= this.config.maxPendingApprovalsPerConversation) {
      return Promise.resolve({
        toolCallId,
        approved: false,
        reason: `Maximum pending approval limit (${this.config.maxPendingApprovalsPerConversation}) reached for this conversation`,
        code: ERROR_CODES.MAX_PENDING_APPROVALS_EXCEEDED,
      });
    }

    return new Promise((resolve) => {
      let settled = false;

      const finalize = (decision: ApprovalDecisionInternal): void => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(decision);
      };

      const timer = setTimeout(() => {
        const pending = this.pendingApprovals.get(toolCallId);
        if (!pending) {
          return;
        }

        this.pendingApprovals.delete(toolCallId);
        finalize({
          toolCallId,
          approved: false,
          reason: `Approval timed out after ${this.config.approvalTimeoutMs}ms`,
          code: ERROR_CODES.APPROVAL_TIMEOUT,
        });
      }, this.config.approvalTimeoutMs);

      this.pendingApprovals.set(toolCallId, {
        conversationId,
        toolCallId,
        toolName,
        toolDef,
        args,
        agentId,
        timer,
        resolve: (decision: ApprovalDecisionInternal) => {
          if (timer) {
            clearTimeout(timer);
          }
          finalize(decision);
        },
      });
    });
  }

  private resolvePendingApproval(
    decision: ApprovalDecisionInternal,
    expectedConversationId?: string
  ): boolean {
    const pending = this.pendingApprovals.get(decision.toolCallId);
    if (!pending) {
      return false;
    }

    if (expectedConversationId && pending.conversationId !== expectedConversationId) {
      return false;
    }

    this.pendingApprovals.delete(decision.toolCallId);

    if (pending.timer) {
      clearTimeout(pending.timer);
    }

    pending.resolve(decision);
    return true;
  }

  /**
   * @description
   * Submits an approval or rejection decision for a pending tool call.
   *
   * Resolves the promise created by `waitForApproval()`, allowing the streaming
   * conversation to continue. Returns false if no pending approval matches the
   * provided `toolCallId`.
   *
   * Related: {@link ApprovalDecision} is the input, {@link createApprovalHandler}
   * wraps this for HTTP endpoints, {@link useToolApproval} calls this from the frontend.
   *
   * @param decision - The approval or rejection decision
   * @returns True if a matching pending approval was found and resolved
   */
  submitApproval(decision: ApprovalDecision): boolean {
    return this.resolvePendingApproval(decision);
  }

  /**
   * @description
   * Returns all pending tool approval requests, optionally filtered by conversation.
   *
   * @param conversationId - Optional filter for a specific conversation
   * @returns Array of pending approval entries
   */
  getPendingApprovals(conversationId?: string): PendingApproval[] {
    const approvals = Array.from(this.pendingApprovals.values());
    if (conversationId) {
      return approvals.filter((a) => a.conversationId === conversationId);
    }
    return approvals;
  }

  private zodToJsonSchema(schema: unknown): Record<string, unknown> {
    return zodToJsonSchemaProvider(schema, this.config.debug);
  }

  private convertToolsToAnthropicFormat(tools: ToolDefinition[]): Anthropic.Tool[] {
    return convertToolsToAnthropicFormatProvider(tools, (schema) => this.zodToJsonSchema(schema));
  }

  private convertToolsToOpenAIFormat(
    tools: ToolDefinition[]
  ): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return convertToolsToOpenAIFormatProvider(tools, (schema) => this.zodToJsonSchema(schema));
  }

  private convertToolsToOllamaFormat(tools: ToolDefinition[]) {
    return convertToolsToOllamaFormatProvider(tools, (schema) => this.zodToJsonSchema(schema));
  }

  private getErrorInfo(error: unknown, fallbackCode?: RuntimeErrorCode): {
    message: string;
    code?: RuntimeErrorCode;
  } {
    const message = error instanceof Error ? error.message : String(error);
    const maybeCode =
      typeof (error as { code?: unknown })?.code === 'string'
        ? ((error as { code: RuntimeErrorCode }).code as RuntimeErrorCode)
        : undefined;

    return {
      message,
      code: maybeCode ?? fallbackCode,
    };
  }

  private createCodedError(message: string, code: RuntimeErrorCode): Error {
    const error = new Error(message) as Error & { code?: RuntimeErrorCode };
    error.code = code;
    return error;
  }

  private buildToolContext(input: RuntimeInput, agentId: string): ToolContext {
    return {
      agentId,
      conversationId: input.conversationId,
      userId: input.userId,
      frontendContext: input.context,
    };
  }

  private requiresApproval(toolDef: ToolDefinition, toolContext: ToolContext): boolean {
    return typeof toolDef.requiresApproval === 'function'
      ? toolDef.requiresApproval(toolContext)
      : Boolean(toolDef.requiresApproval);
  }

  private async executeToolWithGuards(
    toolDef: ToolDefinition,
    toolInput: unknown,
    toolContext: ToolContext
  ): Promise<unknown> {
    let release: (() => void) | null = null;

    try {
      release = await this.toolExecutionSemaphore.acquire(
        this.config.toolExecutionQueueTimeoutMs,
        ERROR_CODES.TOOL_QUEUE_TIMEOUT,
        `Tool execution queue timeout after ${this.config.toolExecutionQueueTimeoutMs}ms`
      );
    } catch (error) {
      const info = this.getErrorInfo(error, ERROR_CODES.TOOL_QUEUE_TIMEOUT);
      throw this.createCodedError(info.message, info.code ?? ERROR_CODES.TOOL_QUEUE_TIMEOUT);
    }

    try {
      const timeoutMs = toolDef.timeout ?? this.config.defaultToolTimeoutMs;
      return await withTimeout(
        () => toolDef.execute(toolInput as never, toolContext),
        timeoutMs,
        `Tool execution timed out after ${timeoutMs}ms`,
        ERROR_CODES.TOOL_TIMEOUT
      );
    } catch (error) {
      const info = this.getErrorInfo(error);
      if (info.code) {
        throw this.createCodedError(info.message, info.code);
      }
      throw error;
    } finally {
      if (release) {
        release();
      }
    }
  }

  private async withInfrastructureRetry<T>(operation: () => Promise<T>): Promise<T> {
    return retryWithBackoff((_) => operation(), {
      ...this.config.retry,
      shouldRetry: isRetryableError,
    });
  }

  private getProviderDependencies(): ProviderDependencies {
    const hooks =
      this.config.hooks?.onToolCall || this.config.hooks?.onToolResult
        ? {
            onToolCall: this.config.hooks?.onToolCall,
            onToolResult: this.config.hooks?.onToolResult,
          }
        : undefined;

    return {
      hooks,
      withInfrastructureRetry: (operation) => this.withInfrastructureRetry(operation),
      buildToolContext: (input, agentId) => this.buildToolContext(input, agentId),
      requiresApproval: (toolDef, toolContext) => this.requiresApproval(toolDef, toolContext),
      waitForApproval: (conversationId, toolCallId, toolName, toolDef, args, agentId) =>
        this.waitForApproval(conversationId, toolCallId, toolName, toolDef, args, agentId),
      executeToolWithGuards: (toolDef, toolInput, toolContext) =>
        this.executeToolWithGuards(toolDef, toolInput, toolContext),
      getErrorInfo: (error, fallbackCode) =>
        this.getErrorInfo(error, fallbackCode as RuntimeErrorCode | undefined),
    };
  }

  private async *streamWithAnthropic(
    input: RuntimeInput,
    agent: AgentDefinition,
    messageId: string,
    currentAgentId: string
  ): AsyncGenerator<RuntimeEvent> {
    const tools =
      agent.tools.length > 0 ? this.convertToolsToAnthropicFormat(agent.tools) : undefined;

    yield* streamWithAnthropicProvider({
      client: this.anthropic,
      input,
      agent,
      messageId,
      currentAgentId,
      tools,
      dependencies: this.getProviderDependencies(),
      maxIterationsExceededCode: ERROR_CODES.MAX_ITERATIONS_EXCEEDED,
    });
  }

  private async *streamWithOpenAI(
    input: RuntimeInput,
    agent: AgentDefinition,
    messageId: string,
    currentAgentId: string
  ): AsyncGenerator<RuntimeEvent> {
    const tools = agent.tools.length > 0 ? this.convertToolsToOpenAIFormat(agent.tools) : undefined;

    yield* streamWithOpenAIProvider({
      client: this.openai,
      input,
      agent,
      messageId,
      currentAgentId,
      tools,
      dependencies: this.getProviderDependencies(),
      maxIterationsExceededCode: ERROR_CODES.MAX_ITERATIONS_EXCEEDED,
    });
  }

  private async *streamWithOllama(
    input: RuntimeInput,
    agent: AgentDefinition,
    messageId: string,
    currentAgentId: string
  ): AsyncGenerator<RuntimeEvent> {
    const tools = agent.tools.length > 0 ? this.convertToolsToOllamaFormat(agent.tools) : undefined;

    yield* streamWithOllamaProvider({
      client: this.ollama,
      input,
      agent,
      messageId,
      currentAgentId,
      tools,
      dependencies: this.getProviderDependencies(),
      maxIterationsExceededCode: ERROR_CODES.MAX_ITERATIONS_EXCEEDED,
    });
  }

  private getAgentTools(agent: AgentDefinition): ToolDefinition[] {
    const handoffTools = generateHandoffTools(agent, this.agents);
    const localTools = [...agent.tools, ...handoffTools];

    // Add MCP tools if configured and agent has allowed servers
    if (this.mcpManager && agent.allowedMcpServers?.length) {
      const mcpTools = this.mcpManager.getToolsForServers(agent.allowedMcpServers);
      const mcpToolDefs = mcpTools.map((t) => this.mcpToolToToolDef(t));
      return [...localTools, ...mcpToolDefs];
    }

    return localTools;
  }

  private mcpToolToToolDef(mcpTool: MCPToolWithServer): ToolDefinition {
    if (this.config.debug) {
      console.log(
        `[mcpToolToToolDef] Tool: ${mcpTool.name} (original: ${mcpTool.originalName}), inputSchema:`,
        JSON.stringify(mcpTool.inputSchema, null, 2)
      );
    }
    return {
      name: mcpTool.name,
      description: mcpTool.description ?? `Tool from MCP server: ${mcpTool.serverName}`,
      inputSchema: mcpTool.inputSchema,
      execute: async (input: unknown) => {
        // Use originalName when calling the MCP server
        return this.mcpManager!.callTool(mcpTool.serverName, mcpTool.originalName, input);
      },
    };
  }

  private async *streamAgentTurn(
    input: RuntimeInput,
    agent: AgentDefinition,
    messageId: string,
    currentAgentId: string
  ): AsyncGenerator<RuntimeEvent | { __internal: 'handoff'; result: HandoffResult }> {
    const provider = agent.model.provider;
    const allTools = this.getAgentTools(agent);

    // Create a modified agent with all tools including handoffs
    const agentWithAllTools = { ...agent, tools: allTools };

    if (provider === LLMProvider.Anthropic) {
      yield* this.streamWithAnthropic(input, agentWithAllTools, messageId, currentAgentId);
    } else if (provider === LLMProvider.OpenAI) {
      yield* this.streamWithOpenAI(input, agentWithAllTools, messageId, currentAgentId);
    } else if (provider === LLMProvider.Ollama) {
      yield* this.streamWithOllama(input, agentWithAllTools, messageId, currentAgentId);
    } else {
      throw new Error(`Unsupported provider: ${provider}. Use 'anthropic', 'openai', or 'ollama'.`);
    }
  }

  private acquireStreamSlot(conversationId: string): StreamSlot {
    if (this.activeStreams >= this.config.maxActiveStreams) {
      return {
        release: () => {},
        errorEvent: {
          type: 'error',
          error: `Maximum active streams limit (${this.config.maxActiveStreams}) reached.`,
          code: ERROR_CODES.MAX_ACTIVE_STREAMS_EXCEEDED,
          category: ErrorCategory.RateLimit,
        },
      };
    }

    const conversationActiveCount = this.activeStreamsByConversation.get(conversationId) ?? 0;
    if (conversationActiveCount >= this.config.maxActiveStreamsPerConversation) {
      return {
        release: () => {},
        errorEvent: {
          type: 'error',
          error: `Conversation already has an active stream (limit ${this.config.maxActiveStreamsPerConversation}).`,
          code: ERROR_CODES.CONVERSATION_BUSY,
          category: ErrorCategory.RateLimit,
        },
      };
    }

    this.activeStreams++;
    this.activeStreamsByConversation.set(conversationId, conversationActiveCount + 1);

    let released = false;
    return {
      release: () => {
        if (released) {
          return;
        }
        released = true;

        this.activeStreams = Math.max(0, this.activeStreams - 1);

        const current = this.activeStreamsByConversation.get(conversationId) ?? 0;
        const next = Math.max(0, current - 1);
        if (next === 0) {
          this.activeStreamsByConversation.delete(conversationId);
        } else {
          this.activeStreamsByConversation.set(conversationId, next);
        }
      },
    };
  }

  private getRateLimitKey(input: RuntimeInput): string {
    const scope = this.config.rateLimit.scope;

    if (scope === 'conversation') {
      return `conversation:${input.conversationId}`;
    }

    if (scope === 'user') {
      return input.userId ? `user:${input.userId}` : `conversation:${input.conversationId}`;
    }

    // user-or-conversation
    return input.userId ? `user:${input.userId}` : `conversation:${input.conversationId}`;
  }

  private checkRateLimit(input: RuntimeInput): RuntimeEventWithCategory | null {
    if (!this.rateLimiter) {
      return null;
    }

    const key = this.getRateLimitKey(input);
    const result = this.rateLimiter.consume(key);

    if (result.allowed) {
      return null;
    }

    return {
      type: 'error',
      error: `Rate limit exceeded. Retry after ${result.retryAfterMs}ms.`,
      code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      category: ErrorCategory.RateLimit,
    };
  }

  /**
   * @description
   * Streams a conversation turn, yielding {@link RuntimeEvent}s in real-time.
   *
   * Supports multi-agent handoffs: if a tool returns a {@link HandoffResult}, the runtime
   * switches to the target agent and continues streaming. The loop terminates when no handoff
   * occurs or the max handoff limit is reached.
   *
   * Resource limits enforced: max active streams (global and per-conversation), rate limiting,
   * tool execution concurrency via {@link Semaphore}, and approval timeouts.
   *
   * @param input - User message and conversation context
   * @returns AsyncGenerator yielding {@link RuntimeEvent} objects
   */
  async *stream(input: RuntimeInput): AsyncGenerator<RuntimeEventWithCategory> {
    const slot = this.acquireStreamSlot(input.conversationId);
    if (slot.errorEvent) {
      yield slot.errorEvent;
      return;
    }

    try {
      const rateLimitError = this.checkRateLimit(input);
      if (rateLimitError) {
        yield rateLimitError;
        return;
      }

      let currentAgentId = this.defaultAgent;
      let handoffCount = 0;
      const maxHandoffs = this.config.maxHandoffs;

      while (handoffCount < maxHandoffs) {
        const agent = this.agents.get(currentAgentId);

        if (!agent) {
          yield { type: 'error', error: `Agent "${currentAgentId}" not found`, category: ErrorCategory.AgentConfig };
          return;
        }

        const messageId = crypto.randomUUID();
        let handoffResult: HandoffResult | null = null;
        let streamHadError = false;

        try {
          yield {
            type: 'message-start',
            messageId,
            agentId: currentAgentId,
          };

          if (this.config.hooks?.onAgentStart) {
            await this.config.hooks.onAgentStart(currentAgentId, {
              conversationId: input.conversationId,
              userId: input.userId,
              frontendContext: input.context ?? {},
            });
          }

          for await (const event of this.streamAgentTurn(input, agent, messageId, currentAgentId)) {
            if ('type' in event && event.type === 'tool-call-result' && isHandoffResult(event.result)) {
              handoffResult = event.result as HandoffResult;
              yield event;
              continue;
            }

            if ('type' in event && event.type === 'error') {
              streamHadError = true;
            }

            yield event as RuntimeEvent;
          }

          if (this.config.hooks?.onAgentEnd) {
            await this.config.hooks.onAgentEnd(currentAgentId, {
              conversationId: input.conversationId,
              userId: input.userId,
              frontendContext: input.context ?? {},
            });
          }

          if (streamHadError) {
            return;
          }

          if (handoffResult) {
            const { targetAgent, reason } = handoffResult;

            yield {
              type: 'agent-handoff',
              fromAgent: currentAgentId,
              toAgent: targetAgent,
              reason,
            };

            if (this.config.hooks?.onHandoff) {
              await this.config.hooks.onHandoff(currentAgentId, targetAgent, reason);
            }

            currentAgentId = targetAgent;
            handoffCount++;
            continue;
          }

          break;
        } catch (error) {
          const info = this.getErrorInfo(error);

          if (this.config.hooks?.onError) {
            await this.config.hooks.onError(
              error instanceof Error ? error : new Error(info.message),
              {
                conversationId: input.conversationId,
                userId: input.userId,
                frontendContext: input.context ?? {},
              }
            );
          }

          // Sanitize error before sending to client to prevent leaking sensitive details
          const sanitized = sanitizeError(error, info.code);

          if (this.config.debug) {
            console.error('[AgentRuntime] Error (raw):', info.message, 'Code:', info.code);
          }

          yield {
            type: 'error',
            error: sanitized.message,
            code: sanitized.code,
            category: sanitized.category,
          };
          return;
        }
      }

      if (handoffCount >= maxHandoffs) {
        yield {
          type: 'error',
          error: `Maximum handoff limit (${maxHandoffs}) reached. Possible infinite loop.`,
          code: ERROR_CODES.MAX_HANDOFFS_EXCEEDED,
          category: ErrorCategory.AgentConfig,
        };
        return;
      }

      yield {
        type: 'stream-complete',
        conversationId: input.conversationId,
      };
    } finally {
      slot.release();
    }
  }

  /**
   * @description
   * Executes a single conversation turn without streaming, returning the final result.
   *
   * Internally calls `stream()` and collects all events into a {@link RuntimeOutput}.
   * Useful for server-to-server calls where streaming is not needed.
   *
   * @param input - User message and conversation context
   * @returns Final response text, active agent, and tool call summaries
   */
  async invoke(input: RuntimeInput): Promise<RuntimeOutput> {
    const agent = this.agents.get(this.defaultAgent);

    if (!agent) {
      throw new Error(`Agent "${this.defaultAgent}" not found`);
    }

    let response = '';
    let activeAgent = this.defaultAgent;
    const toolCalls: RuntimeOutput['toolCalls'] = [];

    for await (const event of this.stream(input)) {
      if (event.type === 'message-start') {
        activeAgent = event.agentId;
      } else if (event.type === 'agent-handoff') {
        activeAgent = event.toAgent;
      } else if (event.type === 'text-complete') {
        response = event.content;
      } else if (event.type === 'tool-call-result') {
        toolCalls?.push({
          toolName: '',
          args: {},
          result: event.result,
          duration: 0,
        });
      }
    }

    return {
      response,
      activeAgent,
      toolCalls,
    };
  }

  /**
   * @description
   * Resolves pending approvals for a conversation and signals completion.
   *
   * Applies each {@link ApprovalDecision} to its matching pending approval. Emits an error
   * event if no approvals matched. Used when the client batches multiple approval decisions.
   *
   * @param conversationId - The conversation containing pending approvals
   * @param approvals - Array of approval decisions to apply
   * @returns AsyncGenerator yielding completion or error events
   */
  async *resumeWithApproval(
    conversationId: string,
    approvals: ApprovalDecision[]
  ): AsyncGenerator<RuntimeEventWithCategory> {
    let appliedCount = 0;

    for (const decision of approvals) {
      const applied = this.resolvePendingApproval(decision, conversationId);
      if (applied) {
        appliedCount++;
      }
    }

    if (appliedCount === 0) {
      yield {
        type: 'error',
        error: 'No matching pending approvals found for this conversation',
        code: 'NO_APPROVALS_APPLIED',
        category: ErrorCategory.Validation,
      };
      return;
    }

    yield {
      type: 'stream-complete',
      conversationId,
    };
  }

  /**
   * @description
   * Returns all registered agent definitions.
   *
   * @returns Array of all {@link AgentDefinition} instances
   */
  getAgents(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /**
   * @description
   * Returns a specific agent definition by ID, or undefined if not found.
   *
   * @param id - Agent identifier
   * @returns The {@link AgentDefinition} or undefined
   */
  getAgent(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /**
   * @description
   * Returns the {@link MCPManager} instance, or null if no MCP servers are configured.
   */
  getMCPManager(): MCPManager | null {
    return this.mcpManager;
  }
}
