/**
 * @description
 * Error thrown when an async operation exceeds its allowed time limit.
 *
 * Contains a `code` field for programmatic error handling (e.g., `'TOOL_TIMEOUT'`,
 * `'APPROVAL_TIMEOUT'`, `'MCP_TIMEOUT'`). Used by {@link withTimeout} and checked by
 * {@link AgentRuntime} to emit appropriate error events.
 *
 * @docsCategory infrastructure
 */
export class TimeoutError extends Error {
  readonly code: string;

  constructor(message: string, code = 'TIMEOUT') {
    super(message);
    this.name = 'TimeoutError';
    this.code = code;
  }
}

/**
 * @description
 * Wraps an async operation with a timeout, rejecting with {@link TimeoutError} if it exceeds the limit.
 *
 * Accepts either a Promise or a factory function that returns a Promise. The timer is cleaned up
 * on both success and failure to prevent memory leaks. Used throughout {@link AgentRuntime} for
 * tool execution timeouts, approval wait timeouts, and MCP request timeouts.
 *
 * @param operation - Promise or factory function to wrap
 * @param timeoutMs - Maximum allowed time in milliseconds
 * @param timeoutMessage - Message for the TimeoutError
 * @param timeoutCode - Error code for the TimeoutError (default: 'TIMEOUT')
 * @returns The operation's resolved value
 * @throws {TimeoutError} If the operation exceeds the timeout
 *
 * @docsCategory infrastructure
 */
export async function withTimeout<T>(
  operation: Promise<T> | (() => Promise<T>),
  timeoutMs: number,
  timeoutMessage: string,
  timeoutCode = 'TIMEOUT'
): Promise<T> {
  const promise = typeof operation === 'function' ? operation() : operation;

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(timeoutMessage, timeoutCode));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}
