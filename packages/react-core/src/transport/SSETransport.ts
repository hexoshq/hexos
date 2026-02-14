import type {
  AgentConfig,
  AgentTransport,
  ApprovalDecision,
  TransportEvent,
  TransportMessage,
} from '../types.js';

/**
 * @description
 * Server-Sent Events transport implementation for agent communication.
 *
 * Default transport that works through all CDNs and proxies. Implements the
 * {@link AgentTransport} interface using HTTP POST requests with streaming
 * response bodies parsed as SSE (`data: {json}\n\n` lines).
 *
 * Supports dynamic headers via async functions (e.g., refreshing JWT tokens),
 * request cancellation via AbortController, and configurable approval endpoints
 * for human-in-the-loop workflows.
 *
 * Related: {@link AgentConfig} configures the connection, {@link useAgent} creates
 * and manages the transport instance, {@link TransportEvent} defines the event types
 * consumed from the SSE stream.
 *
 * @docsCategory transport
 */
export class SSETransport implements AgentTransport {
  private config: AgentConfig | null = null;
  private abortController: AbortController | null = null;
  private listeners: Set<(event: TransportEvent) => void> = new Set();

  /**
   * @description
   * Stores the agent configuration for use in subsequent requests.
   *
   * @param config - The agent configuration with endpoint, headers, etc.
   */
  async connect(config: AgentConfig): Promise<void> {
    this.config = config;
  }

  /**
   * @description
   * Sends a message to the agent endpoint and begins streaming the response.
   *
   * Cancels any existing in-flight request before starting a new one.
   * The response is parsed as SSE and events are emitted to registered listeners.
   *
   * @param message - The transport message containing user input and conversation context
   */
  send(message: TransportMessage): void {
    if (!this.config) {
      this.emit({ type: 'error', error: 'Transport not connected' });
      return;
    }

    // Cancel any existing request
    this.abortController?.abort();
    this.abortController = new AbortController();

    this.streamRequest(message);
  }

  private async streamRequest(message: TransportMessage): Promise<void> {
    if (!this.config) return;

    try {
      // Get headers
      let headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.headers) {
        const configHeaders =
          typeof this.config.headers === 'function'
            ? await this.config.headers()
            : this.config.headers;
        headers = { ...headers, ...configHeaders };
      }

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: message.message,
          conversationId: message.conversationId,
          context: message.context,
        }),
        signal: this.abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const event = JSON.parse(data) as TransportEvent;
              this.emit(event);
            } catch {
              // Ignore parse errors for incomplete data
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled
        return;
      }

      this.emit({
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * @description
   * Sends an approval decision to the server's approval endpoint.
   *
   * Posts an {@link ApprovalDecision} to the configured approval endpoint
   * (defaults to `endpoint + '/approve'`). Supports dynamic headers.
   *
   * @param decision - The approval or rejection decision
   * @throws {Error} If transport is not connected or the server returns an error
   */
  async sendApproval(decision: ApprovalDecision): Promise<void> {
    if (!this.config) {
      throw new Error('Transport not connected');
    }

    // Determine approval endpoint
    const approvalEndpoint = this.config.approvalEndpoint ?? `${this.config.endpoint}/approve`;

    // Get headers
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.headers) {
      const configHeaders =
        typeof this.config.headers === 'function'
          ? await this.config.headers()
          : this.config.headers;
      headers = { ...headers, ...configHeaders };
    }

    const response = await fetch(approvalEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(decision),
    });

    if (!response.ok) {
      throw new Error(`Failed to send approval: HTTP ${response.status}`);
    }
  }

  /**
   * @description
   * Registers a callback to receive transport events.
   *
   * @param callback - Function called for each incoming {@link TransportEvent}
   * @returns Unsubscribe function that removes the callback
   */
  onMessage(callback: (event: TransportEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * @description
   * Disconnects the transport, cancelling any in-flight requests and clearing all listeners.
   */
  disconnect(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.config = null;
    this.listeners.clear();
  }

  private emit(event: TransportEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in transport listener:', error);
      }
    }
  }
}
