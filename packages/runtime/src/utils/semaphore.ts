/**
 * @description
 * Error thrown when a {@link Semaphore} acquire operation times out while waiting in the queue.
 *
 * Contains a `code` field (default: `'SEMAPHORE_QUEUE_TIMEOUT'`) for programmatic error handling.
 * In the context of {@link AgentRuntime}, this maps to the `TOOL_QUEUE_TIMEOUT` error code when
 * a tool cannot acquire a concurrency slot within `toolExecutionQueueTimeoutMs`.
 *
 * @docsCategory infrastructure
 */
export class SemaphoreTimeoutError extends Error {
  readonly code: string;

  constructor(message: string, code = 'SEMAPHORE_QUEUE_TIMEOUT') {
    super(message);
    this.name = 'SemaphoreTimeoutError';
    this.code = code;
  }
}

interface QueueEntry {
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * @description
 * FIFO semaphore that limits the number of concurrent async operations.
 *
 * When the concurrency limit is reached, subsequent `acquire()` calls queue up and wait
 * for a slot to become available. Each successful acquire returns a `release` function that
 * must be called when the operation completes to free the slot. The release function is
 * idempotent — calling it multiple times has no effect.
 *
 * Queue entries can time out via the `timeoutMs` parameter, throwing a
 * {@link SemaphoreTimeoutError}. Used by {@link AgentRuntime} to limit concurrent tool
 * executions via the `maxConcurrentToolExecutions` config.
 *
 * @docsCategory infrastructure
 */
export class Semaphore {
  private inUse = 0;
  private queue: QueueEntry[] = [];

  constructor(private readonly limit: number) {
    if (!Number.isFinite(limit) || limit < 1) {
      throw new Error(`Semaphore limit must be >= 1. Received: ${limit}`);
    }
  }

  /**
   * @description
   * Acquires a concurrency slot, waiting in the FIFO queue if all slots are in use.
   *
   * Returns a release function that must be called when the operation finishes.
   * If the caller waits longer than `timeoutMs`, the request is removed from the
   * queue and a {@link SemaphoreTimeoutError} is thrown.
   *
   * @param timeoutMs - Maximum wait time in the queue
   * @param timeoutCode - Error code for the timeout error
   * @param timeoutMessage - Error message for the timeout error
   * @returns A release function to free the acquired slot
   * @throws {SemaphoreTimeoutError} If the queue wait exceeds timeoutMs
   */
  async acquire(
    timeoutMs: number,
    timeoutCode = 'SEMAPHORE_QUEUE_TIMEOUT',
    timeoutMessage = 'Semaphore acquire timeout'
  ): Promise<() => void> {
    if (this.inUse < this.limit) {
      this.inUse++;
      return this.createRelease();
    }

    return new Promise<() => void>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve,
        reject,
      };

      if (timeoutMs >= 0) {
        entry.timer = setTimeout(() => {
          const index = this.queue.indexOf(entry);
          if (index >= 0) {
            this.queue.splice(index, 1);
          }
          reject(new SemaphoreTimeoutError(timeoutMessage, timeoutCode));
        }, timeoutMs);
      }

      this.queue.push(entry);
    });
  }

  getInUseCount(): number {
    return this.inUse;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  private createRelease(): () => void {
    let released = false;

    return () => {
      if (released) {
        return;
      }
      released = true;

      this.inUse = Math.max(0, this.inUse - 1);
      this.tryDequeue();
    };
  }

  private tryDequeue(): void {
    if (this.inUse >= this.limit) {
      return;
    }

    const next = this.queue.shift();
    if (!next) {
      return;
    }

    if (next.timer) {
      clearTimeout(next.timer);
    }

    this.inUse++;
    next.resolve(this.createRelease());
  }
}
