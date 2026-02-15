/**
 * @description
 * Discriminator for MCP server transport protocols.
 *
 * MCP servers can communicate via `stdio` (local process) or `sse` (HTTP Server-Sent Events).
 * Used by {@link MCPServerConfig} to determine the transport type.
 *
 * @docsCategory mcp
 */
export type MCPTransportType = 'stdio' | 'sse';

/**
 * @description
 * Base configuration shared by all MCP server transport types.
 *
 * Provides common settings for lazy initialization, debug logging, and request timeouts.
 * Lazy servers are not connected at runtime startup — they initialize on first use,
 * reducing startup time when some MCP servers are rarely needed.
 *
 * Related: {@link MCPStdioServerConfig} and {@link MCPSSEServerConfig} extend this base.
 *
 * @docsCategory mcp
 */
export interface MCPServerConfigBase {
  /** Lazy start - only connect when needed */
  lazy?: boolean;
  /** Enable debug logging for this MCP server */
  debug?: boolean;
  /** Request timeout in milliseconds (default: 30000) */
  requestTimeoutMs?: number;
}

/**
 * @description
 * Configuration for an MCP server communicating via stdio (local child process).
 *
 * The runtime spawns the server as a child process using the specified command and arguments.
 * Communication uses JSON-RPC 2.0 over stdin/stdout pipes. Suitable for locally-installed
 * MCP tools like filesystem access or database queries.
 *
 * Related: {@link MCPServerConfigBase} provides shared settings,
 * {@link MCPSSEServerConfig} is the alternative for remote servers.
 *
 * @docsCategory mcp
 */
export interface MCPStdioServerConfig extends MCPServerConfigBase {
  /** Transport type - defaults to 'stdio' for backward compatibility */
  transport?: 'stdio';
  /** Command to start the MCP server */
  command: string;
  /** Arguments for the command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * @description
 * Configuration for an MCP server communicating via HTTP Server-Sent Events.
 *
 * Connects to a remote MCP server over HTTP. Supports custom headers for authentication
 * (e.g., Bearer tokens). Suitable for shared or cloud-hosted MCP servers.
 *
 * Related: {@link MCPServerConfigBase} provides shared settings,
 * {@link MCPStdioServerConfig} is the alternative for local servers.
 *
 * @docsCategory mcp
 */
export interface MCPSSEServerConfig extends MCPServerConfigBase {
  /** Transport type */
  transport: 'sse';
  /** URL of the MCP SSE server endpoint (e.g., 'http://localhost:3001/mcp/sse') */
  url: string;
  /** Optional headers for authentication */
  headers?: Record<string, string>;
  /** Legacy alias for requestTimeoutMs (default: 30000) */
  timeout?: number;
}

/**
 * @description
 * Union type for MCP server configurations, supporting both STDIO and SSE transports.
 *
 * Use {@link isMCPSSEConfig} and {@link isMCPStdioConfig} type guards to narrow the type.
 *
 * @docsCategory mcp
 */
export type MCPServerConfig = MCPStdioServerConfig | MCPSSEServerConfig;

/**
 * @description
 * Type guard that narrows {@link MCPServerConfig} to {@link MCPSSEServerConfig}.
 *
 * @param config - MCP server configuration to check
 * @returns True if the configuration uses SSE transport
 *
 * @docsCategory mcp
 */
export function isMCPSSEConfig(config: MCPServerConfig): config is MCPSSEServerConfig {
  return config.transport === 'sse';
}

/**
 * @description
 * Type guard that narrows {@link MCPServerConfig} to {@link MCPStdioServerConfig}.
 *
 * Defaults to STDIO when no transport is specified, maintaining backward compatibility.
 *
 * @param config - MCP server configuration to check
 * @returns True if the configuration uses STDIO transport (or has no transport specified)
 *
 * @docsCategory mcp
 */
export function isMCPStdioConfig(config: MCPServerConfig): config is MCPStdioServerConfig {
  return !config.transport || config.transport === 'stdio';
}

/**
 * @description
 * Metadata for a tool discovered from an MCP server.
 *
 * Contains the tool name, optional description, and its JSON Schema input definition.
 * Retrieved by {@link MCPManager} during server initialization and cached for reuse.
 *
 * Related: {@link MCPServerConfig} configures the server, {@link ToolDefinition} is the
 * runtime-native equivalent.
 *
 * @docsCategory mcp
 */
export interface MCPToolInfo {
  name: string;
  description?: string;
  inputSchema: unknown; // JSON Schema
}
