import { EventEmitter } from 'events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { MCPSSEServerConfig, MCPToolInfo } from '@hexos/common';
import type { IMCPClient } from './IMCPClient.js';
import { withTimeout } from '../utils/timeout.js';

/**
 * @description
 * MCP client implementation using SSE (Server-Sent Events) transport for HTTP-based communication.
 *
 * Uses the official MCP SDK's SSEClientTransport to communicate with MCP servers over HTTP.
 * The transport connects to an SSE endpoint via GET for receiving server messages and sends
 * client messages via POST to a separate messages endpoint.
 *
 * Note: SSEClientTransport is deprecated in the MCP SDK in favor of StreamableHTTPClientTransport,
 * but is retained here for compatibility with servers using SSEServerTransport.
 *
 * Wraps all requests with configurable timeout handling to prevent indefinite hangs.
 *
 * Implements {@link IMCPClient} interface and is managed by {@link MCPManager}.
 * Configuration provided via {@link MCPSSEServerConfig}.
 *
 * @docsCategory mcp
 */
export class MCPSSEClient extends EventEmitter implements IMCPClient {
  private client: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private connected = false;
  private serverName: string;
  private requestTimeoutMs: number;

  /**
   * @description
   * Create a new SSE MCP client instance.
   *
   * @param serverName - Identifier for this server used in logging and error messages
   * @param config - SSE server configuration including URL, headers, and timeout settings
   */
  constructor(
    serverName: string,
    private config: MCPSSEServerConfig
  ) {
    super();
    this.serverName = serverName;
    this.requestTimeoutMs = this.config.requestTimeoutMs ?? this.config.timeout ?? 30000;
  }

  /**
   * @description
   * Connect to the MCP server via SSE transport.
   *
   * Creates an SSEClientTransport instance pointing to the configured URL and wraps it
   * with an MCP SDK Client. Sets up event handlers for connection lifecycle (close, error).
   * The transport handles the MCP protocol handshake automatically.
   *
   * Idempotent - returns immediately if already connected.
   *
   * @returns Promise that resolves when SSE connection and MCP handshake complete
   * @throws {Error} If transport creation fails or connection cannot be established
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Create the SSE transport
      // SSEClientTransport connects via GET to the SSE endpoint
      // and sends messages via POST to the messages endpoint
      this.transport = new SSEClientTransport(new URL(this.config.url));

      // Create the MCP client
      this.client = new Client(
        {
          name: 'hexos-runtime',
          version: '0.1.0',
        },
        {
          capabilities: {},
        }
      );

      // Set up transport event handlers
      this.transport.onclose = () => {
        console.log(`[MCP:${this.serverName}] SSE connection closed`);
        this.connected = false;
        this.emit('exit', { code: 0, signal: null });
      };

      this.transport.onerror = (error: Error) => {
        console.error(`[MCP:${this.serverName}] SSE transport error:`, error);
        this.emit('error', error);
      };

      // Connect the client to the transport
      await this.client.connect(this.transport);

      this.connected = true;
      console.log(`[MCP:${this.serverName}] Connected via SSE to ${this.config.url}`);
    } catch (error) {
      console.error(`[MCP:${this.serverName}] Failed to connect:`, error);
      throw error;
    }
  }

  /**
   * @description
   * Retrieve all tools available from the MCP server.
   *
   * Calls the MCP SDK's listTools method and transforms the response into the common
   * MCPToolInfo format. Wraps the request with timeout handling to prevent hangs.
   *
   * Supports debug logging of raw tool data via config.debug flag.
   *
   * @returns Promise resolving to array of tool information
   * @throws {Error} If client is not connected, request fails, or times out
   */
  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.connected || !this.client) {
      throw new Error(`MCP SSE client not connected: ${this.serverName}`);
    }

    const result = await withTimeout(
      () => this.client!.listTools(),
      this.requestTimeoutMs,
      'MCP request timeout: tools/list',
      'MCP_TIMEOUT'
    );

    // Debug: log the raw tools from MCP server
    if (this.config.debug) {
      console.log(`[MCP:${this.serverName}] Raw tools from server:`, JSON.stringify(result.tools, null, 2));
    }

    return result.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  /**
   * @description
   * Execute a tool on the MCP server with the provided arguments.
   *
   * Calls the MCP SDK's callTool method with the tool name and arguments. Extracts
   * text content from the MCP response (which returns content arrays) and attempts
   * JSON parsing if the result looks like JSON.
   *
   * Wraps the request with timeout handling to prevent hangs.
   *
   * @param name - The name of the tool to execute
   * @param args - The tool arguments matching the tool's input schema
   * @returns Promise resolving to the tool execution result (parsed JSON or text)
   * @throws {Error} If client is not connected, tool execution fails, or times out
   */
  async callTool(name: string, args: unknown): Promise<unknown> {
    if (!this.connected || !this.client) {
      throw new Error(`MCP SSE client not connected: ${this.serverName}`);
    }

    const result = await withTimeout(
      () =>
        this.client!.callTool({
          name,
          arguments: args as Record<string, unknown>,
        }),
      this.requestTimeoutMs,
      `MCP request timeout: tools/call (${name})`,
      'MCP_TIMEOUT'
    );

    // MCP returns content array with text/image/resource items
    if (result.content && Array.isArray(result.content)) {
      // Extract text content
      const textParts = result.content
        .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('\n');

      // Try to parse as JSON if it looks like JSON
      if (textParts.startsWith('{') || textParts.startsWith('[')) {
        try {
          return JSON.parse(textParts);
        } catch {
          return textParts;
        }
      }

      return textParts || result.content;
    }

    return result;
  }

  /**
   * @description
   * Disconnect from the MCP server and clean up all resources.
   *
   * Closes the SSE transport and MCP client instances, then resets connection state.
   * Transport closure will trigger the onclose handler.
   */
  disconnect(): void {
    if (this.transport) {
      this.transport.close();
      this.transport = null;
    }
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.connected = false;
    console.log(`[MCP:${this.serverName}] Disconnected from SSE`);
  }

  /**
   * @description
   * Check whether the client is currently connected to the MCP server.
   *
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this.connected;
  }
}
