import { MCPClient } from './MCPClient.js';
import { MCPSSEClient } from './MCPSSEClient.js';
import type { IMCPClient } from './IMCPClient.js';
import type {
  MCPServerConfig,
  MCPToolInfo,
  MCPStdioServerConfig,
  MCPSSEServerConfig,
  RetryConfig,
} from '@hexos/common';
import { retryWithBackoff, isRetryableError } from '../utils/retry.js';

/**
 * @description
 * Sanitize a tool name to be compatible with all LLM provider APIs.
 *
 * OpenAI and Anthropic require tool names to match the pattern ^[a-zA-Z0-9_-]+$.
 * This function replaces dots and other invalid characters with underscores to
 * ensure cross-provider compatibility.
 *
 * @param name - The original tool name from the MCP server
 * @returns The sanitized tool name safe for use with any LLM provider
 *
 * @docsCategory mcp
 */
function sanitizeToolName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * @description
 * Extended tool information that includes server identification and name mapping.
 *
 * Extends the base MCPToolInfo with serverName (which server provides this tool) and
 * originalName (the tool's name as defined by the MCP server before sanitization).
 * The name field contains the sanitized version used when registering with LLM providers.
 *
 * Used by {@link MCPManager} when aggregating tools across multiple servers.
 *
 * @docsCategory mcp
 */
export interface MCPToolWithServer extends MCPToolInfo {
  /** The name of the MCP server that provides this tool */
  serverName: string;
  /** The original tool name from the MCP server (used when calling the tool) */
  originalName: string;
}

/**
 * @description
 * Configuration options for MCPManager initialization.
 *
 * @docsCategory mcp
 */
interface MCPManagerOptions {
  /** Retry configuration for connection and tool listing operations */
  retry?: {
    /** Maximum number of retry attempts */
    maxAttempts: number;
    /** Initial delay in milliseconds before first retry */
    initialDelayMs: number;
    /** Maximum delay in milliseconds between retries */
    maxDelayMs: number;
    /** Multiplier for exponential backoff */
    multiplier: number;
    /** Whether to add random jitter to delay */
    jitter: boolean;
  };
}

/**
 * @description
 * Default retry configuration for MCP operations.
 *
 * @docsCategory mcp
 */
const DEFAULT_RETRY: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelayMs: 250,
  maxDelayMs: 2000,
  multiplier: 2,
  jitter: true,
};

/**
 * @description
 * Centralized manager for orchestrating multiple MCP server connections.
 *
 * Handles lifecycle management for a pool of MCP servers, supporting both STDIO and SSE
 * transports. Responsibilities include server initialization, tool discovery and caching,
 * tool execution routing, and graceful shutdown.
 *
 * Supports lazy initialization for servers that should only connect on first use, and
 * implements retry logic with exponential backoff for connection and tool listing operations.
 *
 * Tools from multiple servers are aggregated with server identification, allowing agents
 * to specify which servers they can access via allowedMcpServers configuration.
 *
 * Used by {@link AgentRuntime} to provide MCP tools to {@link AgentDefinition} instances.
 * Creates {@link MCPClient} (STDIO) or {@link MCPSSEClient} (SSE) based on {@link MCPServerConfig}.
 *
 * @docsCategory mcp
 */
export class MCPManager {
  private clients = new Map<string, IMCPClient>();
  private toolsCache = new Map<string, MCPToolInfo[]>();
  private initialized = false;
  private retry: Required<RetryConfig>;

  /**
   * @description
   * Create a new MCPManager instance.
   *
   * @param servers - Map of server name to server configuration
   * @param options - Optional configuration for retry behavior
   */
  constructor(
    private servers: Record<string, MCPServerConfig>,
    options: MCPManagerOptions = {}
  ) {
    this.retry = options.retry ?? DEFAULT_RETRY;
  }

  /**
   * @description
   * Execute an operation with retry logic and exponential backoff.
   *
   * Wraps the operation in retry logic using the configured retry parameters.
   * Only retries on retryable errors (network errors, timeouts, etc.).
   *
   * @param operation - The async operation to retry
   * @returns Promise resolving to the operation result
   * @throws {Error} If all retry attempts fail
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    return retryWithBackoff((_) => operation(), {
      maxAttempts: this.retry.maxAttempts,
      initialDelayMs: this.retry.initialDelayMs,
      maxDelayMs: this.retry.maxDelayMs,
      multiplier: this.retry.multiplier,
      jitter: this.retry.jitter,
      shouldRetry: isRetryableError,
    });
  }

  /**
   * @description
   * Initialize all configured MCP servers that are not marked as lazy.
   *
   * Connects to each non-lazy server in parallel, lists their tools, and caches
   * the results. Servers marked with lazy: true are skipped and will be initialized
   * on first use via ensureServerInitialized.
   *
   * Idempotent - returns immediately if already initialized.
   *
   * @returns Promise that resolves when all non-lazy servers are connected
   * @throws {Error} If any server initialization fails
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const initPromises: Promise<void>[] = [];

    for (const [name, config] of Object.entries(this.servers)) {
      // Skip lazy servers - they'll be initialized on first use
      if (config.lazy) {
        console.log(`[MCPManager] ${name}: Lazy initialization enabled`);
        continue;
      }

      initPromises.push(this.initializeServer(name, config));
    }

    await Promise.all(initPromises);
    this.initialized = true;
    console.log(`[MCPManager] Initialized ${this.clients.size} MCP servers`);
  }

  /**
   * @description
   * Create the appropriate client instance based on transport type.
   *
   * Inspects the transport field in the config to determine whether to create
   * an MCPClient (STDIO) or MCPSSEClient (SSE).
   *
   * @param name - Server name for logging
   * @param config - Server configuration
   * @returns A new client instance implementing IMCPClient
   */
  private createClient(name: string, config: MCPServerConfig): IMCPClient {
    // Check transport type to determine which client to create
    if (config.transport === 'sse') {
      console.log(`[MCPManager] ${name}: Creating SSE client for ${(config as MCPSSEServerConfig).url}`);
      return new MCPSSEClient(name, config as MCPSSEServerConfig);
    } else {
      console.log(`[MCPManager] ${name}: Creating STDIO client for ${(config as MCPStdioServerConfig).command}`);
      return new MCPClient(name, config as MCPStdioServerConfig);
    }
  }

  /**
   * @description
   * Initialize a single MCP server.
   *
   * Creates the appropriate client type, connects with retry logic, lists and caches
   * tools, and sets up event handlers for error and exit events. On exit, the server
   * is removed from the pool and tools cache.
   *
   * @param name - Server name
   * @param config - Server configuration
   * @returns Promise that resolves when server is connected and tools are cached
   * @throws {Error} If connection or tool listing fails after all retries
   */
  private async initializeServer(name: string, config: MCPServerConfig): Promise<void> {
    try {
      const client = this.createClient(name, config);
      await this.withRetry(() => client.connect());
      this.clients.set(name, client);

      // Cache tools
      const tools = await this.withRetry(() => client.listTools());
      this.toolsCache.set(name, tools);
      console.log(`[MCPManager] ${name}: ${tools.length} tools available`);

      // Handle client errors
      client.on('error', (error) => {
        console.error(`[MCPManager] ${name}: Error -`, error);
      });

      client.on('exit', () => {
        console.log(`[MCPManager] ${name}: Server exited, removing from pool`);
        this.clients.delete(name);
        this.toolsCache.delete(name);
      });
    } catch (error) {
      console.error(`[MCPManager] Failed to initialize ${name}:`, error);
      throw error;
    }
  }

  /**
   * @description
   * Ensure a server is initialized, initializing it if necessary.
   *
   * Used for lazy servers that are not initialized during MCPManager.initialize().
   * Checks if the server is already connected; if not, performs initialization.
   *
   * @param name - Server name to ensure is initialized
   * @returns Promise that resolves when server is initialized
   * @throws {Error} If server is not configured or initialization fails
   */
  private async ensureServerInitialized(name: string): Promise<void> {
    if (this.clients.has(name)) {
      return;
    }

    const config = this.servers[name];
    if (!config) {
      throw new Error(`MCP server not configured: ${name}`);
    }

    await this.initializeServer(name, config);
  }

  /**
   * @description
   * Get all tools from the specified MCP servers.
   *
   * Aggregates tools from multiple servers, adding serverName and originalName fields
   * to each tool. Tool names are sanitized for LLM API compatibility.
   *
   * Used by AgentRuntime when preparing tools for agents that specify allowedMcpServers.
   *
   * @param serverNames - Array of server names to get tools from
   * @returns Array of tools with server identification and sanitized names
   */
  getToolsForServers(serverNames: string[]): MCPToolWithServer[] {
    const tools: MCPToolWithServer[] = [];

    for (const name of serverNames) {
      const serverTools = this.toolsCache.get(name) ?? [];
      tools.push(
        ...serverTools.map((t) => ({
          ...t,
          serverName: name,
          originalName: t.name,
          name: sanitizeToolName(t.name),
        }))
      );
    }

    return tools;
  }

  /**
   * @description
   * Get all available tools from all connected servers.
   *
   * Aggregates tools across all servers in the pool, adding serverName and originalName
   * fields to each tool. Tool names are sanitized for LLM API compatibility.
   *
   * @returns Array of all tools with server identification and sanitized names
   */
  getAllTools(): MCPToolWithServer[] {
    const tools: MCPToolWithServer[] = [];

    for (const [name, serverTools] of this.toolsCache) {
      tools.push(
        ...serverTools.map((t) => ({
          ...t,
          serverName: name,
          originalName: t.name,
          name: sanitizeToolName(t.name),
        }))
      );
    }

    return tools;
  }

  /**
   * @description
   * Execute a tool on a specific MCP server.
   *
   * Ensures the server is initialized (handles lazy servers), then routes the tool
   * call to the appropriate client. Uses the original tool name (not sanitized) when
   * calling the server.
   *
   * @param serverName - Name of the server that provides the tool
   * @param toolName - Name of the tool to execute (original name, not sanitized)
   * @param args - Tool arguments matching the tool's input schema
   * @returns Promise resolving to the tool execution result
   * @throws {Error} If server is not available or tool execution fails
   */
  async callTool(serverName: string, toolName: string, args: unknown): Promise<unknown> {
    // Ensure server is initialized (handles lazy servers)
    await this.ensureServerInitialized(serverName);

    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server not available: ${serverName}`);
    }

    return client.callTool(toolName, args);
  }

  /**
   * @description
   * Check if a specific server is connected.
   *
   * @param name - Server name
   * @returns true if server is connected, false otherwise
   */
  isServerConnected(name: string): boolean {
    return this.clients.has(name) && this.clients.get(name)!.isConnected();
  }

  /**
   * @description
   * Get list of currently connected server names.
   *
   * @returns Array of connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * @description
   * Refresh the tools cache for a specific server.
   *
   * Re-queries the server for its tool list and updates the cache. Useful when
   * a server's tools may have changed dynamically.
   *
   * @param serverName - Name of the server to refresh tools for
   * @returns Promise resolving to the updated tool list
   * @throws {Error} If server is not connected or tool listing fails
   */
  async refreshTools(serverName: string): Promise<MCPToolInfo[]> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server not connected: ${serverName}`);
    }

    const tools = await this.withRetry(() => client.listTools());
    this.toolsCache.set(serverName, tools);
    return tools;
  }

  /**
   * @description
   * Shut down all MCP servers and clean up resources.
   *
   * Disconnects all clients, clears the client and tools caches, and resets
   * initialization state. Should be called during application shutdown to ensure
   * graceful cleanup of MCP processes and connections.
   *
   * @returns Promise that resolves when all servers are shut down
   */
  async shutdown(): Promise<void> {
    for (const [name, client] of this.clients) {
      console.log(`[MCPManager] Shutting down ${name}`);
      client.disconnect();
    }
    this.clients.clear();
    this.toolsCache.clear();
    this.initialized = false;
  }
}
