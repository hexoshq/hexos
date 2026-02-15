import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRuntime } from '../AgentRuntime.js';
import { MCPClient } from '../mcp/MCPClient.js';
import { MCPSSEClient } from '../mcp/MCPSSEClient.js';
import { LLMProvider, type AgentDefinition, type ToolDefinition } from '@hexos/common';

function createAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-1',
    name: 'Agent 1',
    description: 'Test agent',
    model: {
      provider: LLMProvider.OpenAI,
      model: 'gpt-4o-mini',
    },
    systemPrompt: 'You are a test agent',
    tools: [],
    ...overrides,
  };
}

function createRuntime(agentOverrides: Partial<AgentDefinition> = {}, runtimeOverrides: Record<string, unknown> = {}) {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? 'test-key';
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? 'test-key';

  const agent = createAgent(agentOverrides);
  return new AgentRuntime({
    agents: [agent],
    ...runtimeOverrides,
  });
}

async function collectEvents<T>(generator: AsyncGenerator<T>): Promise<T[]> {
  const events: T[] = [];
  for await (const event of generator) {
    events.push(event);
  }
  return events;
}

function openAIStreamWithToolCall(toolName: string, args: string, id = 'tool-1') {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id,
                  function: {
                    name: toolName,
                    arguments: args,
                  },
                },
              ],
            },
          },
        ],
      };
    },
  };
}

function openAIStreamWithContent(content: string) {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        choices: [
          {
            delta: {
              content,
            },
          },
        ],
      };
    },
  };
}

function anthropicStreamWithToolCall(toolName: string, args = '{}', id = 'anthropic-tool-1') {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          id,
          name: toolName,
        },
      };
      yield {
        type: 'content_block_delta',
        delta: {
          type: 'input_json_delta',
          partial_json: args,
        },
      };
      yield {
        type: 'content_block_stop',
      };
    },
    async finalMessage() {
      return {
        content: [],
      };
    },
  };
}

function ollamaStreamWithToolCall(toolName: string, args: Record<string, unknown>) {
  return {
    async *[Symbol.asyncIterator]() {
      yield {
        message: {
          tool_calls: [
            {
              function: {
                name: toolName,
                arguments: args,
              },
            },
          ],
        },
      };
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('AgentRuntime hardening', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('emits MAX_HANDOFFS_EXCEEDED on handoff loop', async () => {
    const runtime = createRuntime({}, { maxHandoffs: 2 });

    (runtime as any).streamAgentTurn = async function* () {
      yield {
        type: 'tool-call-result',
        toolCallId: 'handoff-tool',
        result: {
          __handoff: true,
          targetAgent: 'agent-1',
          reason: 'loop',
        },
      };
    };

    const events = await collectEvents(
      runtime.stream({ message: 'loop', conversationId: 'conv-max-handoff' })
    );

    const errorEvent = events.find(
      (event) => (event as { type: string }).type === 'error'
    ) as { type: string; code?: string };

    expect(errorEvent?.code).toBe('MAX_HANDOFFS_EXCEEDED');
  });

  it('emits MAX_ITERATIONS_EXCEEDED in OpenAI flow', async () => {
    const tool: ToolDefinition = {
      name: 'noop',
      description: 'noop',
      inputSchema: {},
      execute: async () => ({ ok: true }),
    };

    const runtime = createRuntime({ tools: [tool], maxIterations: 2 });

    const openaiCreate = vi
      .fn()
      .mockImplementation(() => Promise.resolve(openAIStreamWithToolCall('noop', '{}')));

    (runtime as any).openai = {
      chat: {
        completions: {
          create: openaiCreate,
        },
      },
    };

    const agent = runtime.getAgent('agent-1')!;
    const events = await collectEvents(
      (runtime as any).streamWithOpenAI(
        { message: 'hello', conversationId: 'conv-iter-openai' },
        agent,
        'msg-openai',
        'agent-1'
      )
    );

    const errorEvent = events.find(
      (event) => (event as { type: string }).type === 'error'
    ) as { type: string; code?: string };

    expect(openaiCreate).toHaveBeenCalledTimes(2);
    expect(errorEvent?.code).toBe('MAX_ITERATIONS_EXCEEDED');
  });

  it('emits MAX_ITERATIONS_EXCEEDED in Anthropic and Ollama flows', async () => {
    const tool: ToolDefinition = {
      name: 'noop',
      description: 'noop',
      inputSchema: {},
      execute: async () => ({ ok: true }),
    };

    const runtimeAnthropic = createRuntime(
      { model: { provider: LLMProvider.Anthropic, model: 'claude-3-5-sonnet' }, tools: [tool], maxIterations: 2 },
      {}
    );

    const anthropicStreamFactory = vi
      .fn()
      .mockImplementation(() => anthropicStreamWithToolCall('noop'));

    (runtimeAnthropic as any).anthropic = {
      messages: {
        stream: anthropicStreamFactory,
      },
    };

    const anthropicAgent = runtimeAnthropic.getAgent('agent-1')!;
    const anthropicEvents = await collectEvents(
      (runtimeAnthropic as any).streamWithAnthropic(
        { message: 'hello', conversationId: 'conv-iter-anthropic' },
        anthropicAgent,
        'msg-anthropic',
        'agent-1'
      )
    );

    const anthropicError = anthropicEvents.find(
      (event) => (event as { type: string }).type === 'error'
    ) as { type: string; code?: string };

    expect(anthropicError?.code).toBe('MAX_ITERATIONS_EXCEEDED');

    const runtimeOllama = createRuntime(
      { model: { provider: LLMProvider.Ollama, model: 'llama3.2' }, tools: [tool], maxIterations: 2 },
      {}
    );

    const ollamaChat = vi
      .fn()
      .mockImplementation(() => Promise.resolve(ollamaStreamWithToolCall('noop', {})));

    (runtimeOllama as any).ollama = {
      chat: ollamaChat,
    };

    const ollamaAgent = runtimeOllama.getAgent('agent-1')!;
    const ollamaEvents = await collectEvents(
      (runtimeOllama as any).streamWithOllama(
        { message: 'hello', conversationId: 'conv-iter-ollama' },
        ollamaAgent,
        'msg-ollama',
        'agent-1'
      )
    );

    const ollamaError = ollamaEvents.find(
      (event) => (event as { type: string }).type === 'error'
    ) as { type: string; code?: string };

    expect(ollamaError?.code).toBe('MAX_ITERATIONS_EXCEEDED');
  });

  it('auto-rejects approval on timeout with APPROVAL_TIMEOUT', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const tool: ToolDefinition = {
      name: 'protected_tool',
      description: 'needs approval',
      inputSchema: {},
      requiresApproval: true,
      execute,
    };

    const runtime = createRuntime(
      { tools: [tool] },
      { approvalTimeoutMs: 5 }
    );

    const openaiCreate = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(openAIStreamWithToolCall('protected_tool', '{}', 'approve-1')))
      .mockImplementationOnce(() => Promise.resolve(openAIStreamWithContent('done')));

    (runtime as any).openai = {
      chat: {
        completions: {
          create: openaiCreate,
        },
      },
    };

    const events = await collectEvents(
      runtime.stream({ message: 'please run tool', conversationId: 'conv-approval-timeout' })
    );

    const toolError = events.find(
      (event) => (event as { type: string }).type === 'tool-call-error'
    ) as { type: string; code?: string };

    expect(toolError?.code).toBe('APPROVAL_TIMEOUT');
    expect(execute).not.toHaveBeenCalled();
  });

  it('executes tool when manual approval is submitted before timeout', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const tool: ToolDefinition = {
      name: 'protected_tool',
      description: 'needs approval',
      inputSchema: {},
      requiresApproval: true,
      execute,
    };

    const runtime = createRuntime(
      { tools: [tool] },
      { approvalTimeoutMs: 5000 }
    );

    const openaiCreate = vi
      .fn()
      .mockImplementationOnce(() => Promise.resolve(openAIStreamWithToolCall('protected_tool', '{}', 'approve-manual')))
      .mockImplementationOnce(() => Promise.resolve(openAIStreamWithContent('done')));

    (runtime as any).openai = {
      chat: {
        completions: {
          create: openaiCreate,
        },
      },
    };

    const events: Array<{ type: string; toolCallId?: string }> = [];
    const iterator = runtime.stream({ message: 'please run tool', conversationId: 'conv-approval-manual' });

    while (true) {
      const next = await iterator.next();
      if (next.done) {
        break;
      }

      const event = next.value as { type: string; toolCallId?: string };
      events.push(event);

      if (event.type === 'approval-required' && event.toolCallId) {
        setTimeout(() => {
          runtime.submitApproval({
            toolCallId: event.toolCallId!,
            approved: true,
          });
        }, 0);
      }
    }

    expect(events.some((event) => event.type === 'tool-call-result')).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('rejects new pending approval when maxPendingApprovalsPerConversation is exceeded', async () => {
    const runtime = createRuntime({}, { maxPendingApprovalsPerConversation: 1, approvalTimeoutMs: 5_000 });

    const toolDef: ToolDefinition = {
      name: 'tool',
      description: 'tool',
      inputSchema: {},
      execute: async () => ({}),
    };

    const first = (runtime as any).waitForApproval(
      'conv-pending',
      'pending-1',
      'tool',
      toolDef,
      {},
      'agent-1'
    ) as Promise<{ approved: boolean }>;

    const second = (runtime as any).waitForApproval(
      'conv-pending',
      'pending-2',
      'tool',
      toolDef,
      {},
      'agent-1'
    ) as Promise<{ approved: boolean; code?: string }>;

    const secondDecision = await second;
    expect(secondDecision.approved).toBe(false);
    expect(secondDecision.code).toBe('MAX_PENDING_APPROVALS_EXCEEDED');

    runtime.submitApproval({ toolCallId: 'pending-1', approved: true });
    const firstDecision = await first;
    expect(firstDecision.approved).toBe(true);
  });

  it('applies default and per-tool execution timeout', async () => {
    const runtime = createRuntime({}, { defaultToolTimeoutMs: 10, toolExecutionQueueTimeoutMs: 1000 });

    const context = {
      agentId: 'agent-1',
      conversationId: 'conv-tool-timeout',
      userId: 'user-1',
    };

    const defaultTimeoutTool: ToolDefinition = {
      name: 'slow-default',
      description: 'slow default',
      inputSchema: {},
      execute: async () => {
        await sleep(25);
        return { ok: true };
      },
    };

    const overrideTimeoutTool: ToolDefinition = {
      name: 'slow-override',
      description: 'slow override',
      inputSchema: {},
      timeout: 50,
      execute: async () => {
        await sleep(25);
        return { ok: true };
      },
    };

    await expect(
      (runtime as any).executeToolWithGuards(defaultTimeoutTool, {}, context)
    ).rejects.toMatchObject({ code: 'TOOL_TIMEOUT' });

    await expect(
      (runtime as any).executeToolWithGuards(overrideTimeoutTool, {}, context)
    ).resolves.toEqual({ ok: true });
  });

  it('enforces tool execution queue timeout with maxConcurrentToolExecutions', async () => {
    const runtime = createRuntime(
      {},
      {
        maxConcurrentToolExecutions: 1,
        toolExecutionQueueTimeoutMs: 5,
        defaultToolTimeoutMs: 1_000,
      }
    );

    const context = {
      agentId: 'agent-1',
      conversationId: 'conv-tool-queue',
      userId: 'user-1',
    };

    const tool: ToolDefinition = {
      name: 'slow',
      description: 'slow',
      inputSchema: {},
      execute: async () => {
        await sleep(30);
        return { ok: true };
      },
    };

    const first = (runtime as any).executeToolWithGuards(tool, {}, context);
    const second = (runtime as any).executeToolWithGuards(tool, {}, context);

    await expect(second).rejects.toMatchObject({ code: 'TOOL_QUEUE_TIMEOUT' });
    await expect(first).resolves.toEqual({ ok: true });
  });

  it('enforces maxActiveStreamsPerConversation and maxActiveStreams', async () => {
    const runtimeConversation = createRuntime(
      {},
      { maxActiveStreamsPerConversation: 1, maxActiveStreams: 5 }
    );

    let releaseConversationStream!: () => void;
    const conversationBlock = new Promise<void>((resolve) => {
      releaseConversationStream = resolve;
    });

    (runtimeConversation as any).streamAgentTurn = async function* () {
      await conversationBlock;
      yield { type: 'text-complete', messageId: 'm', content: 'ok' };
    };

    const firstConversation = runtimeConversation.stream({
      message: 'a',
      conversationId: 'conv-busy',
    });
    await firstConversation.next();

    const secondConversation = runtimeConversation.stream({
      message: 'b',
      conversationId: 'conv-busy',
    });
    const secondConversationFirstEvent = (await secondConversation.next()).value as {
      type: string;
      code?: string;
    };

    expect(secondConversationFirstEvent.type).toBe('error');
    expect(secondConversationFirstEvent.code).toBe('CONVERSATION_BUSY');

    releaseConversationStream();
    await collectEvents(firstConversation);

    const runtimeGlobal = createRuntime(
      {},
      { maxActiveStreams: 1, maxActiveStreamsPerConversation: 1 }
    );

    let releaseGlobalStream!: () => void;
    const globalBlock = new Promise<void>((resolve) => {
      releaseGlobalStream = resolve;
    });

    (runtimeGlobal as any).streamAgentTurn = async function* () {
      await globalBlock;
      yield { type: 'text-complete', messageId: 'm', content: 'ok' };
    };

    const firstGlobal = runtimeGlobal.stream({ message: 'a', conversationId: 'conv-1' });
    await firstGlobal.next();

    const secondGlobal = runtimeGlobal.stream({ message: 'b', conversationId: 'conv-2' });
    const secondGlobalFirstEvent = (await secondGlobal.next()).value as {
      type: string;
      code?: string;
    };

    expect(secondGlobalFirstEvent.type).toBe('error');
    expect(secondGlobalFirstEvent.code).toBe('MAX_ACTIVE_STREAMS_EXCEEDED');

    releaseGlobalStream();
    await collectEvents(firstGlobal);
  });

  it('enforces rate limit and retries transient model errors', async () => {
    const runtimeRateLimit = createRuntime(
      {},
      {
        rateLimit: {
          enabled: true,
          scope: 'user-or-conversation',
          windowMs: 60_000,
          maxRequests: 1,
        },
      }
    );

    (runtimeRateLimit as any).streamAgentTurn = async function* (_input: unknown, _agent: unknown, messageId: string) {
      yield { type: 'text-complete', messageId, content: 'ok' };
    };

    const firstRateEvents = await collectEvents(
      runtimeRateLimit.stream({ message: 'a', conversationId: 'conv-rate', userId: 'user-rate' })
    );
    expect(firstRateEvents.some((event) => (event as { type: string }).type === 'stream-complete')).toBe(
      true
    );

    const secondRateEvents = await collectEvents(
      runtimeRateLimit.stream({ message: 'b', conversationId: 'conv-rate', userId: 'user-rate' })
    );
    const rateError = secondRateEvents.find(
      (event) => (event as { type: string }).type === 'error'
    ) as { type: string; code?: string };
    expect(rateError.code).toBe('RATE_LIMIT_EXCEEDED');

    const runtimeRetrySuccess = createRuntime(
      { tools: [] },
      {
        retry: {
          maxAttempts: 2,
          initialDelayMs: 1,
          maxDelayMs: 2,
          multiplier: 2,
          jitter: false,
        },
      }
    );

    const openaiCreateRetrySuccess = vi
      .fn()
      .mockRejectedValueOnce({ status: 429, message: 'rate limit' })
      .mockResolvedValueOnce(openAIStreamWithContent('ok'));

    (runtimeRetrySuccess as any).openai = {
      chat: {
        completions: {
          create: openaiCreateRetrySuccess,
        },
      },
    };

    const retrySuccessEvents = await collectEvents(
      runtimeRetrySuccess.stream({ message: 'retry', conversationId: 'conv-retry-success' })
    );

    expect(openaiCreateRetrySuccess).toHaveBeenCalledTimes(2);
    expect(
      retrySuccessEvents.some((event) => (event as { type: string }).type === 'text-complete')
    ).toBe(true);

    const runtimeRetryFail = createRuntime(
      { tools: [] },
      {
        retry: {
          maxAttempts: 3,
          initialDelayMs: 1,
          maxDelayMs: 2,
          multiplier: 2,
          jitter: false,
        },
      }
    );

    const openaiCreateRetryFail = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('bad request'), { status: 400 }));

    (runtimeRetryFail as any).openai = {
      chat: {
        completions: {
          create: openaiCreateRetryFail,
        },
      },
    };

    const retryFailEvents = await collectEvents(
      runtimeRetryFail.stream({ message: 'no-retry', conversationId: 'conv-retry-fail' })
    );

    expect(openaiCreateRetryFail).toHaveBeenCalledTimes(1);
    const retryFailError = retryFailEvents.find(
      (event) => (event as { type: string }).type === 'error'
    ) as { type: string; error: string };
    // Error is sanitized — raw "bad request" is replaced with user-friendly message
    expect(retryFailError.error).toContain('Invalid request');
  });

  it('applies MCP timeout in STDIO and SSE clients', async () => {
    const stdioClient = new MCPClient('stdio-test', {
      command: 'node',
      requestTimeoutMs: 5,
    });

    (stdioClient as any).process = {
      stdin: {
        writable: true,
        write: (_message: string, callback?: (error?: Error | null) => void) => {
          callback?.(null);
        },
      },
    };

    await expect((stdioClient as any).sendRequest('tools/list', {})).rejects.toMatchObject({
      code: 'MCP_TIMEOUT',
    });

    const sseClient = new MCPSSEClient('sse-test', {
      transport: 'sse',
      url: 'http://localhost:9876/mcp/sse',
      timeout: 5,
    });

    (sseClient as any).connected = true;
    (sseClient as any).client = {
      listTools: () => new Promise(() => {}),
      callTool: () => new Promise(() => {}),
    };

    await expect(sseClient.listTools()).rejects.toMatchObject({ code: 'MCP_TIMEOUT' });
    await expect(sseClient.callTool('any', {})).rejects.toMatchObject({ code: 'MCP_TIMEOUT' });
  });

  it('uses current handoff agent id in tool events/context and supports resumeWithApproval', async () => {
    const contextSpy = vi.fn();
    const tool: ToolDefinition = {
      name: 'handoff_tool',
      description: 'tool',
      inputSchema: {},
      requiresApproval: true,
      execute: async (_input, context) => {
        contextSpy(context.agentId);
        return { ok: true };
      },
    };

    const runtime = new AgentRuntime({
      agents: [
        createAgent({ id: 'agent-1', tools: [] }),
        createAgent({ id: 'agent-2', tools: [tool] }),
      ],
      defaultAgent: 'agent-1',
      approvalTimeoutMs: 5_000,
    });

    const openaiCreate = vi
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(openAIStreamWithToolCall('handoff_tool', '{}', 'handoff-tool-call'))
      )
      .mockImplementationOnce(() => Promise.resolve(openAIStreamWithContent('done')));

    (runtime as any).openai = {
      chat: {
        completions: {
          create: openaiCreate,
        },
      },
    };

    const agentTwo = runtime.getAgent('agent-2')!;
    const events: Array<{ type: string; agentId?: string; toolCallId?: string }> = [];
    const generator = (runtime as any).streamWithOpenAI(
      { message: 'run', conversationId: 'conv-agentid' },
      agentTwo,
      'msg-agent-2',
      'agent-2'
    ) as AsyncGenerator<{ type: string; agentId?: string; toolCallId?: string }>;

    while (true) {
      const next = await generator.next();
      if (next.done) {
        break;
      }
      events.push(next.value);

      if (next.value.type === 'approval-required' && next.value.toolCallId) {
        setTimeout(() => {
          runtime.submitApproval({ toolCallId: next.value.toolCallId!, approved: true });
        }, 0);
      }
    }

    const toolStartEvent = events.find((event) => event.type === 'tool-call-start');
    const approvalEvent = events.find((event) => event.type === 'approval-required');

    expect(toolStartEvent?.agentId).toBe('agent-2');
    expect(approvalEvent?.agentId).toBe('agent-2');
    expect(contextSpy).toHaveBeenCalledWith('agent-2');

    const runtimeResume = createRuntime({}, { approvalTimeoutMs: 5_000 });
    const toolDef: ToolDefinition = {
      name: 'tool',
      description: 'tool',
      inputSchema: {},
      execute: async () => ({}),
    };

    const pending = (runtimeResume as any).waitForApproval(
      'conv-resume',
      'resume-1',
      'tool',
      toolDef,
      {},
      'agent-1'
    ) as Promise<{ approved: boolean }>;

    const resumeEvents = await collectEvents(
      runtimeResume.resumeWithApproval('conv-resume', [{ toolCallId: 'resume-1', approved: true }])
    );
    expect(
      resumeEvents.some((event) => (event as { type: string }).type === 'stream-complete')
    ).toBe(true);
    await expect(pending).resolves.toMatchObject({ approved: true });

    const invalidResumeEvents = await collectEvents(
      runtimeResume.resumeWithApproval('conv-other', [{ toolCallId: 'missing', approved: true }])
    );
    const invalidResumeError = invalidResumeEvents.find(
      (event) => (event as { type: string }).type === 'error'
    ) as { type: string; code?: string };

    expect(invalidResumeError.code).toBe('NO_APPROVALS_APPLIED');
  });
});
