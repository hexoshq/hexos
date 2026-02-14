import type { ApprovalDecision, RuntimeInput, ToolContext, ToolDefinition } from '@hexos/common';

/**
 * @description
 * Extended approval decision with optional provider-specific error code.
 *
 * Used by provider implementations to include error codes when a tool execution
 * is rejected during the approval flow.
 *
 * @see {@link ApprovalDecision} for base approval decision structure
 *
 * @docsCategory llm-providers
 */
export interface ProviderApprovalDecision extends ApprovalDecision {
  code?: string;
}

/**
 * @description
 * Provider error information containing message and optional code.
 *
 * Standardized error structure used across all LLM providers to return
 * consistent error information to the runtime.
 *
 * @docsCategory llm-providers
 */
export interface ProviderErrorInfo {
  message: string;
  code?: string;
}

/**
 * @description
 * Optional lifecycle hooks for tool execution.
 *
 * Providers call these hooks before and after tool execution, enabling
 * instrumentation, logging, or custom behavior injection.
 *
 * @see {@link ToolDefinition} for tool definition structure
 *
 * @docsCategory llm-providers
 */
export interface ProviderHooks {
  onToolCall?: (toolName: string, args: unknown) => void | Promise<void>;
  onToolResult?: (toolName: string, result: unknown) => void | Promise<void>;
}

/**
 * @description
 * Runtime dependencies injected into LLM provider streaming functions.
 *
 * Contains all necessary runtime operations that providers delegate to the
 * parent AgentRuntime, including infrastructure retry logic, approval flows,
 * tool execution guards, and context building. This interface decouples
 * provider implementations from runtime internals.
 *
 * All methods are synchronous or async as needed. Approval flow methods
 * (requiresApproval, waitForApproval) enable human-in-the-loop patterns.
 *
 * @see {@link RuntimeInput} for input structure
 * @see {@link ToolContext} for tool execution context
 * @see {@link ToolDefinition} for tool definition structure
 * @see {@link ProviderHooks} for lifecycle hooks
 * @see {@link ProviderApprovalDecision} for approval decision structure
 * @see {@link ProviderErrorInfo} for error structure
 *
 * @docsCategory llm-providers
 */
export interface ProviderDependencies {
  hooks?: ProviderHooks;
  withInfrastructureRetry<T>(operation: () => Promise<T>): Promise<T>;
  buildToolContext(input: RuntimeInput, agentId: string): ToolContext;
  requiresApproval(toolDef: ToolDefinition, toolContext: ToolContext): boolean;
  waitForApproval(
    conversationId: string,
    toolCallId: string,
    toolName: string,
    toolDef: ToolDefinition,
    args: unknown,
    agentId: string
  ): Promise<ProviderApprovalDecision>;
  executeToolWithGuards(
    toolDef: ToolDefinition,
    toolInput: unknown,
    toolContext: ToolContext
  ): Promise<unknown>;
  getErrorInfo(error: unknown, fallbackCode?: string): ProviderErrorInfo;
}
