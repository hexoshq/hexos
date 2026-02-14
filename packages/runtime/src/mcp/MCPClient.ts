import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import type { MCPStdioServerConfig, MCPToolInfo } from '@hexos/common';
import type { IMCPClient } from './IMCPClient.js';

/**
 * @description
 * MCP client implementation using STDIO transport for process-based communication.
 *
 * Spawns an MCP server as a child process and communicates via JSON-RPC messages
 * over standard input/output streams. Handles the MCP protocol handshake, request/response
 * correlation, and protocol-compliant message formatting.
 *
 * Messages are newline-delimited JSON-RPC 2.0 format. Supports both requests (with ID,
 * expecting responses) and notifications (no ID, no response expected).
 *
 * Implements {@link IMCPClient} interface and is managed by {@link MCPManager}.
 * Configuration provided via {@link MCPStdioServerConfig}.
 *
 * @docsCategory mcp
 */
export class MCPClient extends EventEmitter implements IMCPClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  private buffer = '';
  private connected = false;
  private serverName: string;
  private requestTimeoutMs: number;

  /**
   * @description
   * Create a new STDIO MCP client instance.
   *
   * @param serverName - Identifier for this server used in logging and error messages
   * @param config - STDIO server configuration including command, args, env, and cwd
   */
  constructor(
    serverName: string,
    private config: MCPStdioServerConfig
  ) {
    super();
    this.serverName = serverName;
    this.requestTimeoutMs = this.config.requestTimeoutMs ?? 30000;
  }

  /**
   * @description
   * Connect to the MCP server by spawning the configured child process.
   *
   * Spawns the process with the configured command, args, and environment. Sets up
   * event listeners for process lifecycle (error, exit) and stdio streams. Performs
   * the MCP handshake by sending initialize request followed by initialized notification.
   *
   * Idempotent - returns immediately if already connected.
   *
   * @returns Promise that resolves when connection and handshake complete
   * @throws {Error} If process spawn fails or initialization times out
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(this.config.command, this.config.args ?? [], {
          env: { ...process.env, ...this.config.env },
          cwd: this.config.cwd,
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.process.on('error', (error) => {
          console.error(`[MCP:${this.serverName}] Process error:`, error);
          this.emit('error', error);
          reject(error);
        });

        this.process.on('exit', (code, signal) => {
          console.log(`[MCP:${this.serverName}] Process exited: code=${code}, signal=${signal}`);
          this.connected = false;
          this.emit('exit', { code, signal });
        });

        this.process.stdout?.on('data', (data: Buffer) => this.handleData(data));

        this.process.stderr?.on('data', (data: Buffer) => {
          const message = data.toString().trim();
          if (message) {
            console.error(`[MCP:${this.serverName}] stderr:`, message);
          }
        });

        // Initialize MCP connection
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          clientInfo: {
            name: 'hexos-runtime',
            version: '0.1.0',
          },
        })
          .then(() => {
            // Send initialized notification
            this.sendNotification('notifications/initialized', {});
            this.connected = true;
            console.log(`[MCP:${this.serverName}] Connected successfully`);
            resolve();
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * @description
   * Retrieve all tools available from the MCP server.
   *
   * Sends a tools/list JSON-RPC request and parses the response to extract tool
   * metadata. Returns empty array if no tools are available.
   *
   * @returns Promise resolving to array of tool information
   * @throws {Error} If client is not connected or request fails
   */
  async listTools(): Promise<MCPToolInfo[]> {
    if (!this.connected) {
      throw new Error(`MCP client not connected: ${this.serverName}`);
    }

    const result = await this.sendRequest('tools/list', {});
    const toolsResult = result as { tools?: MCPToolInfo[] };
    return toolsResult.tools ?? [];
  }

  /**
   * @description
   * Execute a tool on the MCP server with the provided arguments.
   *
   * Sends a tools/call request with tool name and arguments. Extracts text content
   * from the MCP response (which returns content arrays) and attempts JSON parsing
   * if the result looks like JSON.
   *
   * @param name - The name of the tool to execute
   * @param args - The tool arguments matching the tool's input schema
   * @returns Promise resolving to the tool execution result (parsed JSON or text)
   * @throws {Error} If client is not connected or tool execution fails
   */
  async callTool(name: string, args: unknown): Promise<unknown> {
    if (!this.connected) {
      throw new Error(`MCP client not connected: ${this.serverName}`);
    }

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    // MCP returns content array with text/image/resource items
    const callResult = result as { content?: Array<{ type: string; text?: string }> };

    if (callResult.content && Array.isArray(callResult.content)) {
      // Extract text content
      const textParts = callResult.content
        .filter((c) => c.type === 'text')
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

      return textParts || callResult.content;
    }

    return result;
  }

  /**
   * @description
   * Disconnect from the MCP server and clean up all resources.
   *
   * Sends SIGTERM to the child process, clears pending request map and input buffer,
   * and resets connection state. All pending requests will be rejected implicitly
   * when the process exits.
   */
  disconnect(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
    this.connected = false;
    this.pendingRequests.clear();
    this.buffer = '';
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

  /**
   * @description
   * Send a JSON-RPC request to the MCP server and await the response.
   *
   * Generates a unique request ID, writes the JSON-RPC message to stdin, and
   * registers a promise that will resolve/reject when the matching response arrives.
   * Implements request timeout to prevent hanging on unresponsive servers.
   *
   * @param method - The JSON-RPC method name (e.g., 'tools/list', 'tools/call')
   * @param params - The request parameters
   * @returns Promise resolving to the result field from the JSON-RPC response
   * @throws {Error} If stdin is not writable, write fails, or request times out
   */
  private sendRequest(method: string, params: unknown): Promise<unknown> {
    const id = ++this.requestId;
    const message =
      JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }) + '\n';

    return new Promise((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('MCP process stdin not writable'));
        return;
      }

      this.pendingRequests.set(id, { resolve, reject });

      this.process.stdin.write(message, (error) => {
        if (error) {
          this.pendingRequests.delete(id);
          reject(error);
        }
      });

      // Request timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          const timeoutError = new Error(`MCP request timeout: ${method}`) as Error & {
            code?: string;
          };
          timeoutError.code = 'MCP_TIMEOUT';
          reject(timeoutError);
        }
      }, this.requestTimeoutMs);
    });
  }

  /**
   * @description
   * Send a JSON-RPC notification to the MCP server (no response expected).
   *
   * Notifications are JSON-RPC messages without an ID field. The server does not
   * send a response. Used for the initialized notification after the handshake.
   *
   * @param method - The notification method name
   * @param params - The notification parameters
   */
  private sendNotification(method: string, params: unknown): void {
    const message =
      JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
      }) + '\n';

    this.process?.stdin?.write(message);
  }

  /**
   * @description
   * Handle incoming data from the MCP server's stdout stream.
   *
   * Buffers incoming data and processes complete newline-delimited JSON messages.
   * Parses each message and either resolves/rejects a pending request (if message
   * has an ID) or emits a notification event (if message is a server notification).
   *
   * @param data - Raw buffer data from stdout
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString();

    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line) as {
          id?: number;
          result?: unknown;
          error?: { message: string; code?: number };
          method?: string;
          params?: unknown;
        };

        // Handle response to our request
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
          const { resolve, reject } = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);

          if (message.error) {
            reject(new Error(message.error.message));
          } else {
            resolve(message.result);
          }
        }

        // Handle notifications from server (if any)
        if (message.method && !message.id) {
          this.emit('notification', {
            method: message.method,
            params: message.params,
          });
        }
      } catch (e) {
        console.error(`[MCP:${this.serverName}] Parse error:`, e, 'Line:', line);
      }
    }
  }
}
