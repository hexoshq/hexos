/**
 * @description
 * Options for configuring exponential backoff retry behavior.
 *
 * Controls the number of attempts, delay progression, and error classification for
 * {@link retryWithBackoff}. The optional `shouldRetry` predicate allows overriding the
 * default {@link isRetryableError} logic for custom error handling.
 *
 * Related: {@link NormalizedRetryConfig} provides the runtime defaults,
 * {@link RetryConfig} is the user-facing configuration.
 *
 * @docsCategory infrastructure
 */
export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitter: boolean;
  shouldRetry?: (error: unknown) => boolean;
}

const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'ENOTFOUND',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown };
  if (typeof candidate.status === 'number') {
    return candidate.status;
  }
  if (typeof candidate.statusCode === 'number') {
    return candidate.statusCode;
  }
  if (typeof candidate.code === 'number') {
    return candidate.code;
  }

  return null;
}

function extractCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }

  const candidate = error as { code?: unknown };
  if (typeof candidate.code === 'string') {
    return candidate.code;
  }

  return null;
}

/**
 * @description
 * Determines whether an error is transient and safe to retry.
 *
 * Classifies errors as retryable based on three criteria:
 * 1. HTTP status codes: 408 (timeout), 429 (rate limit), 5xx (server errors)
 * 2. Network error codes: ECONNRESET, ETIMEDOUT, ECONNREFUSED, etc.
 * 3. Error message keywords: "timeout", "rate limit", "temporarily unavailable", "network"
 *
 * Used as the default predicate for {@link retryWithBackoff} when no custom
 * `shouldRetry` function is provided.
 *
 * @param error - The error to classify
 * @returns True if the error is likely transient and retryable
 *
 * @docsCategory infrastructure
 */
export function isRetryableError(error: unknown): boolean {
  const status = extractStatus(error);
  if (status !== null) {
    return status === 408 || status === 429 || (status >= 500 && status < 600);
  }

  const code = extractCode(error);
  if (code && NETWORK_ERROR_CODES.has(code)) {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'string'
        ? error.toLowerCase()
        : '';

  return (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('rate limit') ||
    message.includes('temporarily unavailable') ||
    message.includes('fetch failed') ||
    message.includes('network')
  );
}

/**
 * @description
 * Executes an async operation with exponential backoff retry on transient failures.
 *
 * Retries the operation up to `maxAttempts` times. The delay between retries grows as
 * `initialDelayMs * multiplier^attempt`, capped at `maxDelayMs`. When `jitter` is enabled,
 * each delay is randomized by 50-100% to prevent thundering herd effects.
 *
 * By default uses {@link isRetryableError} to determine if an error is retryable.
 * Override via the `shouldRetry` option for custom classification.
 *
 * Used by {@link AgentRuntime} for LLM API calls and MCP server connections.
 *
 * @param operation - Async function to execute; receives the current attempt number (1-based)
 * @param options - Retry configuration
 * @returns The operation's return value on success
 * @throws The last error if all attempts fail or an error is non-retryable
 *
 * @docsCategory infrastructure
 */
export async function retryWithBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const shouldRetry = options.shouldRetry ?? isRetryableError;
  let delayMs = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      const canRetry = attempt < options.maxAttempts && shouldRetry(error);
      if (!canRetry) {
        throw error;
      }

      const jitterMultiplier = options.jitter ? 0.5 + Math.random() : 1;
      const actualDelay = Math.min(delayMs, options.maxDelayMs) * jitterMultiplier;
      await sleep(Math.max(0, Math.floor(actualDelay)));

      delayMs = Math.min(Math.floor(delayMs * options.multiplier), options.maxDelayMs);
    }
  }

  throw new Error('retryWithBackoff exhausted without result');
}
