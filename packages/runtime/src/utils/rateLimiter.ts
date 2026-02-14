/**
 * @description
 * Result of a rate limit check, indicating whether the request is allowed.
 *
 * When `allowed` is false, `retryAfterMs` indicates how long the caller should wait
 * before retrying. The `remaining` field shows how many requests are still available
 * in the current window.
 *
 * Related: {@link SlidingWindowRateLimiter} produces this result.
 *
 * @docsCategory infrastructure
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
  remaining: number;
  limit: number;
}

/**
 * @description
 * In-memory sliding window rate limiter that tracks request counts per key over a time window.
 *
 * Each key (typically a user ID or conversation ID) maintains its own request timestamp array.
 * On each `consume()` call, timestamps outside the window are pruned and the request is either
 * allowed (if under the limit) or rejected (with a `retryAfterMs` hint).
 *
 * Used by {@link AgentRuntime} to enforce per-user and per-conversation request limits as
 * configured by {@link RateLimitConfig}. The scope (user, conversation, or both) determines
 * the key used for tracking.
 *
 * @docsCategory infrastructure
 */
export class SlidingWindowRateLimiter {
  private requestsByKey = new Map<string, number[]>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number
  ) {
    if (!Number.isFinite(windowMs) || windowMs < 1) {
      throw new Error(`windowMs must be >= 1. Received: ${windowMs}`);
    }

    if (!Number.isFinite(maxRequests) || maxRequests < 1) {
      throw new Error(`maxRequests must be >= 1. Received: ${maxRequests}`);
    }
  }

  /**
   * @description
   * Attempts to consume a rate limit token for the given key.
   *
   * Prunes expired timestamps, checks the remaining quota, and either records the request
   * (if allowed) or returns retry information (if the limit is exceeded).
   *
   * @param key - Rate limit key (user ID, conversation ID, or composite)
   * @param now - Current timestamp in milliseconds (default: Date.now())
   * @returns Rate limit result with allowed status and remaining quota
   */
  consume(key: string, now = Date.now()): RateLimitResult {
    const existing = this.requestsByKey.get(key) ?? [];
    const minTimestamp = now - this.windowMs;
    const recent = existing.filter((ts) => ts > minTimestamp);

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0] ?? now;
      const retryAfterMs = Math.max(0, this.windowMs - (now - oldest));
      this.requestsByKey.set(key, recent);

      return {
        allowed: false,
        retryAfterMs,
        remaining: 0,
        limit: this.maxRequests,
      };
    }

    recent.push(now);
    this.requestsByKey.set(key, recent);

    return {
      allowed: true,
      retryAfterMs: 0,
      remaining: Math.max(0, this.maxRequests - recent.length),
      limit: this.maxRequests,
    };
  }
}
