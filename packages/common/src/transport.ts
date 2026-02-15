import type { RuntimeEvent } from './events.js';
import type { Attachment } from './messages.js';

/**
 * @description
 * Frontend configuration for connecting to an Hexos backend endpoint.
 *
 * Passed to {@link useAgent} hook or {@link AgentProvider} to establish the client-server
 * connection. The `headers` field supports both static objects and async functions for
 * dynamic authentication (e.g., refreshing JWT tokens before each request).
 *
 * The `enableReasoning` flag requests extended thinking content from the LLM, which
 * arrives as `reasoning-delta` {@link RuntimeEvent}s.
 *
 * Related: {@link SSETransport} uses this to connect, {@link useAgent} accepts this as input,
 * {@link AgentProvider} can initialize with this config.
 *
 * @docsCategory transport
 */
export interface AgentConfig {
  endpoint: string;
  agents?: string[];
  transport?: 'sse' | 'websocket';
  headers?: Record<string, string> | (() => Promise<Record<string, string>>);
  conversationId?: string;
  enableReasoning?: boolean;
}

/**
 * @description
 * Alias for {@link RuntimeEvent}, used on the frontend to represent events received from the transport layer.
 *
 * @docsCategory transport
 */
export type TransportEvent = RuntimeEvent;

/**
 * @description
 * Message payload sent from the frontend client to the backend via the transport layer.
 *
 * Contains the user's message text, conversation ID, optional frontend context, and
 * file attachments. Sent by {@link SSETransport}.send() as the HTTP request body.
 *
 * Related: {@link AgentTransport} defines the send contract,
 * {@link RuntimeInput} is the server-side equivalent.
 *
 * @docsCategory transport
 */
export interface TransportMessage {
  type: 'send-message';
  message: string;
  conversationId: string;
  context?: Record<string, unknown>;
  attachments?: Attachment[];
}

/**
 * @description
 * Abstract transport interface for client-server communication in Hexos.
 *
 * Defines the contract for connecting to a backend, sending messages, receiving events,
 * and disconnecting. {@link SSETransport} is the default implementation using HTTP
 * Server-Sent Events. Future implementations could support WebSockets or other protocols.
 *
 * Related: {@link SSETransport} implements this interface, {@link AgentConfig} configures
 * the connection, {@link TransportMessage} is the outbound payload,
 * {@link TransportEvent} is the inbound event type.
 *
 * @docsCategory transport
 */
export interface AgentTransport {
  connect(config: AgentConfig): Promise<void>;
  send(message: TransportMessage): void;
  onMessage(callback: (event: TransportEvent) => void): () => void;
  disconnect(): void;
}
