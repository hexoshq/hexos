/**
 * Error categories for classifying runtime errors.
 * Matches the ErrorCategory enum in @hexos/common (defined locally to avoid
 * cross-package build dependency on unpublished types).
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

export interface SanitizedError {
  message: string;
  code?: string;
  category: ErrorCategory;
}

/** Default user-friendly messages by category */
const DEFAULT_ERROR_MESSAGES: Record<ErrorCategory, string> = {
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

/** Code-specific overrides for more precise messages */
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

function getUserFriendlyMessage(category: ErrorCategory, code?: string): string {
  if (code && code in CODE_SPECIFIC_MESSAGES) {
    return CODE_SPECIFIC_MESSAGES[code];
  }
  return DEFAULT_ERROR_MESSAGES[category];
}

// Patterns that indicate specific error categories
const AUTH_PATTERNS = [
  /api.?key/i,
  /unauthorized/i,
  /\b401\b/,
  /authentication/i,
  /invalid.*key/i,
  /incorrect.*key/i,
  /forbidden/i,
  /\b403\b/,
];

const RATE_LIMIT_PATTERNS = [/rate.?limit/i, /\b429\b/, /too many requests/i, /quota/i];

const TIMEOUT_PATTERNS = [/timeout/i, /timed?\s?out/i];

const NETWORK_PATTERNS = [
  /network/i,
  /econnrefused/i,
  /econnreset/i,
  /enotfound/i,
  /fetch failed/i,
  /etimedout/i,
  /eai_again/i,
];

const VALIDATION_PATTERNS = [/\b400\b.*bad request/i, /\b422\b/i, /validation/i];

// Map existing ERROR_CODES to categories
const CODE_TO_CATEGORY: Record<string, ErrorCategory> = {
  MAX_HANDOFFS_EXCEEDED: ErrorCategory.AgentConfig,
  MAX_ITERATIONS_EXCEEDED: ErrorCategory.AgentConfig,
  RATE_LIMIT_EXCEEDED: ErrorCategory.RateLimit,
  MAX_ACTIVE_STREAMS_EXCEEDED: ErrorCategory.RateLimit,
  CONVERSATION_BUSY: ErrorCategory.RateLimit,
  TOOL_QUEUE_TIMEOUT: ErrorCategory.Timeout,
  TOOL_TIMEOUT: ErrorCategory.Timeout,
  APPROVAL_TIMEOUT: ErrorCategory.Timeout,
  MAX_PENDING_APPROVALS_EXCEEDED: ErrorCategory.AgentConfig,
  MCP_TIMEOUT: ErrorCategory.Timeout,
};

/**
 * Classifies an error by category based on its code, HTTP status, or message content.
 */
function classifyError(message: string, code?: string, status?: number): ErrorCategory {
  if (code && code in CODE_TO_CATEGORY) {
    return CODE_TO_CATEGORY[code];
  }

  if (status) {
    if (status === 401 || status === 403) return ErrorCategory.Auth;
    if (status === 429) return ErrorCategory.RateLimit;
    if (status === 400 || status === 422) return ErrorCategory.Validation;
    if (status === 408) return ErrorCategory.Timeout;
    if (status >= 500) return ErrorCategory.Server;
  }

  if (AUTH_PATTERNS.some((p) => p.test(message))) return ErrorCategory.Auth;
  if (RATE_LIMIT_PATTERNS.some((p) => p.test(message))) return ErrorCategory.RateLimit;
  if (TIMEOUT_PATTERNS.some((p) => p.test(message))) return ErrorCategory.Timeout;
  if (NETWORK_PATTERNS.some((p) => p.test(message))) return ErrorCategory.Network;
  if (VALIDATION_PATTERNS.some((p) => p.test(message))) return ErrorCategory.Validation;

  return ErrorCategory.Unknown;
}

/**
 * Extracts HTTP status code from error objects (works with Anthropic SDK, OpenAI SDK, etc.).
 */
function extractHttpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const e = error as { status?: unknown; statusCode?: unknown };
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  return undefined;
}

// Hexos-internal error codes whose messages are safe to pass through
const INTERNAL_CODES = new Set(Object.keys(CODE_TO_CATEGORY));

/**
 * Sanitizes an error for client consumption.
 *
 * Classifies the error by category using its code, HTTP status, or message patterns,
 * then returns a safe, user-friendly message. Raw provider error messages (which may
 * contain API keys or internal details) are never passed through.
 *
 * Errors with known Hexos-internal codes (e.g., `RATE_LIMIT_EXCEEDED`) keep their
 * original messages since those are generated by the runtime and are safe.
 */
export function sanitizeError(error: unknown, fallbackCode?: string): SanitizedError {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const code =
    (typeof (error as { code?: unknown })?.code === 'string'
      ? (error as { code: string }).code
      : fallbackCode) ?? undefined;
  const status = extractHttpStatus(error);
  const category = classifyError(rawMessage, code, status);

  // Internal Hexos errors have safe, self-generated messages
  if (code && INTERNAL_CODES.has(code)) {
    return { message: rawMessage, code, category };
  }

  // For external errors, use generic category-based message to avoid leaking details
  return {
    message: getUserFriendlyMessage(category, code),
    code,
    category,
  };
}
