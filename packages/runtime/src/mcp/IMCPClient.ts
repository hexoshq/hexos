import { EventEmitter } from 'events';
import type { MCPToolInfo } from '@hexos/common';

/**
 * @description
 * Common interface for Model Context Protocol (MCP) client implementations.
 *
 * Defines the contract that all MCP clients must fulfill, regardless of the underlying
 * transport mechanism (STDIO or SSE). Clients must handle connection lifecycle, tool
 * discovery, and tool execution according to the MCP protocol specification.
 *
 * Extends EventEmitter to support event-driven communication patterns such as error
 * handling and connection state changes.
 *
 * Implemented by {@link MCPClient} (STDIO transport) and {@link MCPSSEClient} (SSE transport).
 * Managed by {@link MCPManager} for multi-server orchestration.
 *
 * @docsCategory mcp
 */
export interface IMCPClient extends EventEmitter {
  /**
   * @description
   * Establish connection to the MCP server.
   *
   * For STDIO clients, this spawns the child process and performs the MCP handshake
   * (initialize + initialized notification). For SSE clients, this establishes the
   * SSE connection and initializes the MCP client instance.
   *
   * Must be idempotent - calling multiple times should not create duplicate connections.
   *
   * @returns Promise that resolves when connection is established
   * @throws {Error} If connection fails or server is unreachable
   */
  connect(): Promise<void>;

  /**
   * @description
   * Retrieve all tools available from the connected MCP server.
   *
   * Sends a tools/list request via the MCP protocol and returns tool metadata
   * including names, descriptions, and JSON schemas for input validation.
   *
   * @returns Promise resolving to array of tool information from the server
   * @throws {Error} If client is not connected or request fails
   */
  listTools(): Promise<MCPToolInfo[]>;

  /**
   * @description
   * Execute a tool on the MCP server with the provided arguments.
   *
   * Sends a tools/call request and returns the result. The MCP protocol returns
   * content arrays (text/image/resource items), which implementations typically
   * extract and parse into usable formats.
   *
   * @param name - The name of the tool to execute
   * @param args - The tool arguments as defined by the tool's input schema
   * @returns Promise resolving to the tool execution result
   * @throws {Error} If client is not connected, tool not found, or execution fails
   */
  callTool(name: string, args: unknown): Promise<unknown>;

  /**
   * @description
   * Terminate the connection to the MCP server and clean up resources.
   *
   * For STDIO clients, this kills the child process. For SSE clients, this closes
   * the transport and MCP client instances. Should clear all pending requests and
   * reset connection state.
   */
  disconnect(): void;

  /**
   * @description
   * Check whether the client is currently connected to the MCP server.
   *
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean;
}
