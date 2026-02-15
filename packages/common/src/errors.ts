/**
 * @description
 * Categories for classifying runtime errors by their nature.
 *
 * Used by the error sanitizer in `@hexos/runtime` to classify errors before they reach
 * the client, and by frontend components to display appropriate UI (e.g., different
 * icons or retry behavior based on category).
 *
 * @docsCategory core-types
 */
export enum ErrorCategory {
  Auth = 'auth',
  Validation = 'validation',
  RateLimit = 'rate_limit',
  Timeout = 'timeout',
  Network = 'network',
  Server = 'server',
  AgentConfig = 'agent_config',
  ToolExecution = 'tool_execution',
  Unknown = 'unknown',
}

/**
 * @description
 * Structured error info used across Hexos packages.
 *
 * The `message` field contains a sanitized, user-safe string. The `code` field preserves
 * existing error codes (e.g., `RATE_LIMIT_EXCEEDED`). The `category` field enables
 * UI-level display logic and error classification.
 *
 * @docsCategory core-types
 */
export interface HexosError {
  message: string;
  code?: string;
  category: ErrorCategory;
}

/**
 * @description
 * Default user-friendly error messages keyed by {@link ErrorCategory}.
 *
 * Used as fallback messages when displaying errors to users. The runtime sanitizer
 * uses these to replace raw technical error messages before they reach the client.
 *
 * @docsCategory core-types
 */
export const DEFAULT_ERROR_MESSAGES: Record<ErrorCategory, string> = {
  [ErrorCategory.Auth]: 'Authentication failed. Please check your credentials and try again.',
  [ErrorCategory.Validation]: 'Invalid request. Please check your input and try again.',
  [ErrorCategory.RateLimit]: 'Too many requests. Please wait a moment and try again.',
  [ErrorCategory.Timeout]: 'The request timed out. Please try again.',
  [ErrorCategory.Network]: 'A network error occurred. Please check your connection and try again.',
  [ErrorCategory.Server]: 'An internal error occurred. Please try again later.',
  [ErrorCategory.AgentConfig]: 'Agent configuration error. Please contact support.',
  [ErrorCategory.ToolExecution]: 'A tool encountered an error during execution.',
  [ErrorCategory.Unknown]: 'Something went wrong. Please try again.',
};

const CODE_SPECIFIC_MESSAGES: Record<string, string> = {
  MAX_HANDOFFS_EXCEEDED:
    'The conversation reached its routing limit. Please start a new conversation.',
  MAX_ITERATIONS_EXCEEDED:
    'The agent reached its processing limit. Please try a simpler request.',
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait a moment and try again.',
  MAX_ACTIVE_STREAMS_EXCEEDED: 'Too many active conversations. Please wait and try again.',
  CONVERSATION_BUSY: 'This conversation is already processing a request. Please wait.',
  TOOL_TIMEOUT: 'A tool took too long to respond. Please try again.',
  TOOL_QUEUE_TIMEOUT: 'Tool execution queue is full. Please try again.',
  APPROVAL_TIMEOUT: 'The approval request timed out.',
  MAX_PENDING_APPROVALS_EXCEEDED: 'Too many pending approvals. Please resolve existing ones first.',
  MCP_TIMEOUT: 'An external tool server timed out. Please try again.',
};

/**
 * @description
 * Returns a user-friendly error message for a given error category and optional code.
 *
 * Prefers code-specific messages (e.g., `CONVERSATION_BUSY` → specific message),
 * then falls back to the default message for the category.
 *
 * @param category - The error category
 * @param code - Optional error code for more specific messages
 * @returns A user-friendly error message string
 *
 * @docsCategory core-types
 */
export function getUserFriendlyErrorMessage(category: ErrorCategory, code?: string): string {
  if (code && code in CODE_SPECIFIC_MESSAGES) {
    return CODE_SPECIFIC_MESSAGES[code];
  }
  return DEFAULT_ERROR_MESSAGES[category];
}
