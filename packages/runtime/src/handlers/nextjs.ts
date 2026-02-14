import type { AgentRuntime } from '../AgentRuntime.js';
import type { RuntimeInput, RuntimeEvent, ApprovalDecision } from '../types.js';

/**
 * @description
 * Creates a Next.js App Router handler for streaming agent conversations.
 *
 * Returns an object with a `POST` method compatible with Next.js route handlers. On each request,
 * it parses the {@link RuntimeInput} from the request body, initializes MCP servers on first use
 * (lazy), and streams {@link RuntimeEvent}s back as Server-Sent Events (SSE).
 *
 * The stream follows the SSE format: each event is a `data: {json}\n\n` line, terminated by
 * `data: [DONE]\n\n`. Errors during streaming are emitted as error events before closing.
 *
 * Related: {@link AgentRuntime}.stream() produces the events, {@link SSETransport} consumes them
 * on the frontend, {@link createApprovalHandler} handles tool approval decisions.
 *
 * @param runtime - The initialized AgentRuntime instance
 * @returns Object with POST handler for Next.js App Router
 *
 * @docsCategory agent-runtime
 */
export function createAgentHandler(runtime: AgentRuntime) {
  let initialized = false;

  return {
    async POST(request: Request): Promise<Response> {
      try {
        // Initialize MCP servers on first request (lazy initialization)
        if (!initialized) {
          await runtime.initialize();
          initialized = true;
        }

        const body = (await request.json()) as RuntimeInput;

        // Validate required fields
        if (!body.message) {
          return new Response(JSON.stringify({ error: 'Message is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (!body.conversationId) {
          body.conversationId = crypto.randomUUID();
        }

        // Create SSE stream
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const event of runtime.stream(body)) {
                const data = `data: ${JSON.stringify(event)}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            } catch (error) {
              const errorEvent: RuntimeEvent = {
                type: 'error',
                error: error instanceof Error ? error.message : String(error),
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
            } finally {
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Internal server error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },
  };
}

/**
 * @description
 * Creates a Next.js App Router handler for processing tool approval decisions.
 *
 * Receives {@link ApprovalDecision} payloads and forwards them to {@link AgentRuntime}.submitApproval().
 * Returns 404 if no matching pending approval exists. Use alongside {@link createAgentHandler}
 * for human-in-the-loop workflows.
 *
 * Related: {@link ToolApproval} represents the pending request, {@link useToolApproval} sends
 * decisions from the frontend, {@link AgentRuntime}.waitForApproval() blocks until resolved.
 *
 * @param runtime - The initialized AgentRuntime instance
 * @returns Object with POST handler for Next.js App Router
 *
 * @docsCategory agent-runtime
 */
export function createApprovalHandler(runtime: AgentRuntime) {
  return {
    async POST(request: Request): Promise<Response> {
      try {
        const body = (await request.json()) as ApprovalDecision;

        // Validate required fields
        if (!body.toolCallId) {
          return new Response(JSON.stringify({ error: 'toolCallId is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (typeof body.approved !== 'boolean') {
          return new Response(JSON.stringify({ error: 'approved (boolean) is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const success = runtime.submitApproval(body);

        if (!success) {
          return new Response(
            JSON.stringify({ error: 'No pending approval found for this toolCallId' }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Internal server error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    },
  };
}

/**
 * @description
 * Creates an Express/Fastify-compatible middleware handler for streaming agent conversations.
 *
 * Sets SSE response headers and streams {@link RuntimeEvent}s as `data: {json}\n\n` lines.
 * Initializes MCP servers on first request. Compatible with any framework that provides
 * `req.body`, `res.setHeader()`, `res.write()`, and `res.end()`.
 *
 * Related: {@link createAgentHandler} is the Next.js equivalent,
 * {@link AgentRuntime}.stream() produces the events.
 *
 * @param runtime - The initialized AgentRuntime instance
 * @returns Async middleware function
 *
 * @docsCategory agent-runtime
 */
export function createExpressHandler(runtime: AgentRuntime) {
  let initialized = false;

  return async (
    req: { body: RuntimeInput },
    res: {
      setHeader: (name: string, value: string) => void;
      write: (data: string) => void;
      end: () => void;
    }
  ) => {
    // Initialize MCP servers on first request (lazy initialization)
    if (!initialized) {
      await runtime.initialize();
      initialized = true;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const input: RuntimeInput = {
      message: req.body.message,
      conversationId: req.body.conversationId ?? crypto.randomUUID(),
      context: req.body.context,
      userId: req.body.userId,
    };

    try {
      for await (const event of runtime.stream(input)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (error) {
      const errorEvent: RuntimeEvent = {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    } finally {
      res.end();
    }
  };
}
