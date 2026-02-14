import type { AgentDefinition, RuntimeConfig } from '@hexos/common';

/**
 * @description
 * Normalized rate limit configuration with all optional fields resolved to concrete values.
 *
 * Produced by {@link normalizeRuntimeConfig} from the user-provided {@link RateLimitConfig}.
 * Guarantees that all fields are present and validated, safe for direct use by
 * {@link SlidingWindowRateLimiter}.
 *
 * @docsCategory infrastructure
 */
export interface NormalizedRateLimitConfig {
  enabled: boolean;
  scope: 'user' | 'conversation' | 'user-or-conversation';
  windowMs: number;
  maxRequests: number;
}

/**
 * @description
 * Normalized retry configuration with all optional fields resolved to concrete values.
 *
 * Produced by {@link normalizeRuntimeConfig} from the user-provided {@link RetryConfig}.
 * Guarantees that all fields are present and validated, safe for direct use by
 * {@link retryWithBackoff}.
 *
 * @docsCategory infrastructure
 */
export interface NormalizedRetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitter: boolean;
}

/**
 * @description
 * Fully resolved runtime configuration where all optional numeric fields have concrete defaults.
 *
 * Extends {@link RuntimeConfig} with non-optional versions of all limit fields. Created by
 * {@link normalizeRuntimeConfig} at startup, this type is used internally by {@link AgentRuntime}
 * to avoid repeated null checks during operation.
 *
 * @docsCategory infrastructure
 */
export interface NormalizedRuntimeConfig extends RuntimeConfig {
  maxHandoffs: number;
  approvalTimeoutMs: number;
  maxPendingApprovalsPerConversation: number;
  defaultToolTimeoutMs: number;
  maxActiveStreams: number;
  maxActiveStreamsPerConversation: number;
  maxConcurrentToolExecutions: number;
  toolExecutionQueueTimeoutMs: number;
  rateLimit: NormalizedRateLimitConfig;
  retry: NormalizedRetryConfig;
}

const DEFAULT_RATE_LIMIT: NormalizedRateLimitConfig = {
  enabled: true,
  scope: 'user-or-conversation',
  windowMs: 60_000,
  maxRequests: 120,
};

const DEFAULT_RETRY: NormalizedRetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 250,
  maxDelayMs: 2000,
  multiplier: 2,
  jitter: true,
};

function assertNumber(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number. Received: ${String(value)}`);
  }
}

function assertAtLeast(name: string, value: number, min: number): void {
  if (value < min) {
    throw new Error(`${name} must be >= ${min}. Received: ${value}`);
  }
}

function validateAgentConfig(agents: AgentDefinition[]): void {
  for (const agent of agents) {
    if (agent.maxIterations !== undefined) {
      assertNumber(`agents.${agent.id}.maxIterations`, agent.maxIterations);
      assertAtLeast(`agents.${agent.id}.maxIterations`, agent.maxIterations, 1);
    }

    for (const tool of agent.tools) {
      if (tool.timeout !== undefined) {
        assertNumber(`tools.${agent.id}.${tool.name}.timeout`, tool.timeout);
        assertAtLeast(`tools.${agent.id}.${tool.name}.timeout`, tool.timeout, 0);
      }
    }
  }
}

/**
 * @description
 * Merges user-provided {@link RuntimeConfig} with sensible defaults and validates all values.
 *
 * Applies default values for every optional numeric field (maxHandoffs, timeouts, concurrency limits,
 * rate limiting, retry policy). Then validates that all numeric values are finite, non-negative, and
 * internally consistent (e.g., `retry.maxDelayMs >= retry.initialDelayMs`). Also validates per-agent
 * configs (maxIterations, tool timeouts) and MCP server timeouts.
 *
 * Called once by {@link AgentRuntime} during construction.
 *
 * @param config - User-provided runtime configuration
 * @returns Fully resolved configuration with all defaults applied
 * @throws {Error} If any value fails validation
 *
 * @docsCategory infrastructure
 */
export function normalizeRuntimeConfig(config: RuntimeConfig): NormalizedRuntimeConfig {
  const rateLimit: NormalizedRateLimitConfig = {
    ...DEFAULT_RATE_LIMIT,
    ...(config.rateLimit ?? {}),
  };

  const retry: NormalizedRetryConfig = {
    ...DEFAULT_RETRY,
    ...(config.retry ?? {}),
  };

  const normalized: NormalizedRuntimeConfig = {
    ...config,
    maxHandoffs: config.maxHandoffs ?? 10,
    approvalTimeoutMs: config.approvalTimeoutMs ?? 300_000,
    maxPendingApprovalsPerConversation: config.maxPendingApprovalsPerConversation ?? 20,
    defaultToolTimeoutMs: config.defaultToolTimeoutMs ?? 60_000,
    maxActiveStreams: config.maxActiveStreams ?? 100,
    maxActiveStreamsPerConversation: config.maxActiveStreamsPerConversation ?? 1,
    maxConcurrentToolExecutions: config.maxConcurrentToolExecutions ?? 8,
    toolExecutionQueueTimeoutMs: config.toolExecutionQueueTimeoutMs ?? 10_000,
    rateLimit,
    retry,
  };

  assertNumber('maxHandoffs', normalized.maxHandoffs);
  assertAtLeast('maxHandoffs', normalized.maxHandoffs, 1);

  assertNumber('approvalTimeoutMs', normalized.approvalTimeoutMs);
  assertAtLeast('approvalTimeoutMs', normalized.approvalTimeoutMs, 0);

  assertNumber('maxPendingApprovalsPerConversation', normalized.maxPendingApprovalsPerConversation);
  assertAtLeast('maxPendingApprovalsPerConversation', normalized.maxPendingApprovalsPerConversation, 1);

  assertNumber('defaultToolTimeoutMs', normalized.defaultToolTimeoutMs);
  assertAtLeast('defaultToolTimeoutMs', normalized.defaultToolTimeoutMs, 0);

  assertNumber('maxActiveStreams', normalized.maxActiveStreams);
  assertAtLeast('maxActiveStreams', normalized.maxActiveStreams, 1);

  assertNumber('maxActiveStreamsPerConversation', normalized.maxActiveStreamsPerConversation);
  assertAtLeast('maxActiveStreamsPerConversation', normalized.maxActiveStreamsPerConversation, 1);

  assertNumber('maxConcurrentToolExecutions', normalized.maxConcurrentToolExecutions);
  assertAtLeast('maxConcurrentToolExecutions', normalized.maxConcurrentToolExecutions, 1);

  assertNumber('toolExecutionQueueTimeoutMs', normalized.toolExecutionQueueTimeoutMs);
  assertAtLeast('toolExecutionQueueTimeoutMs', normalized.toolExecutionQueueTimeoutMs, 0);

  assertNumber('rateLimit.windowMs', normalized.rateLimit.windowMs);
  assertAtLeast('rateLimit.windowMs', normalized.rateLimit.windowMs, 1);

  assertNumber('rateLimit.maxRequests', normalized.rateLimit.maxRequests);
  assertAtLeast('rateLimit.maxRequests', normalized.rateLimit.maxRequests, 1);

  assertNumber('retry.maxAttempts', normalized.retry.maxAttempts);
  assertAtLeast('retry.maxAttempts', normalized.retry.maxAttempts, 1);

  assertNumber('retry.initialDelayMs', normalized.retry.initialDelayMs);
  assertAtLeast('retry.initialDelayMs', normalized.retry.initialDelayMs, 0);

  assertNumber('retry.maxDelayMs', normalized.retry.maxDelayMs);
  assertAtLeast('retry.maxDelayMs', normalized.retry.maxDelayMs, 0);

  assertNumber('retry.multiplier', normalized.retry.multiplier);
  assertAtLeast('retry.multiplier', normalized.retry.multiplier, 1);

  if (normalized.retry.maxDelayMs < normalized.retry.initialDelayMs) {
    throw new Error(
      `retry.maxDelayMs must be >= retry.initialDelayMs. Received: ${normalized.retry.maxDelayMs} < ${normalized.retry.initialDelayMs}`
    );
  }

  validateAgentConfig(normalized.agents);

  if (normalized.mcpServers) {
    for (const [serverName, serverConfig] of Object.entries(normalized.mcpServers)) {
      const requestTimeoutMs = serverConfig.requestTimeoutMs;
      if (requestTimeoutMs !== undefined) {
        assertNumber(`mcpServers.${serverName}.requestTimeoutMs`, requestTimeoutMs);
        assertAtLeast(`mcpServers.${serverName}.requestTimeoutMs`, requestTimeoutMs, 0);
      }

      if (
        serverConfig.transport === 'sse' &&
        (serverConfig as { timeout?: number }).timeout !== undefined
      ) {
        const legacyTimeout = (serverConfig as { timeout: number }).timeout;
        assertNumber(`mcpServers.${serverName}.timeout`, legacyTimeout);
        assertAtLeast(`mcpServers.${serverName}.timeout`, legacyTimeout, 0);
      }
    }
  }

  return normalized;
}
