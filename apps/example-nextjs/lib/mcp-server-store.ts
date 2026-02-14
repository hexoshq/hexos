import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { type RuntimeConfig } from '@hexos/runtime';

export type EffectiveMcpServers = NonNullable<RuntimeConfig['mcpServers']>;

export type LocalMcpServerConfig =
  | {
      transport: 'stdio';
      command: string;
      args?: string[];
    }
  | {
      transport: 'sse';
      url: string;
    };

export type LocalMcpServers = Record<string, LocalMcpServerConfig>;

const LOCAL_MCP_SERVERS_FILE = '.mcp-servers.local.json';
const LOCAL_MCP_SERVERS_PATH = path.resolve(process.cwd(), LOCAL_MCP_SERVERS_FILE);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLocalMcpServerConfig(value: unknown): value is LocalMcpServerConfig {
  if (!isObjectRecord(value) || typeof value.transport !== 'string') {
    return false;
  }

  if (value.transport === 'stdio') {
    return (
      typeof value.command === 'string' &&
      value.command.trim().length > 0 &&
      (value.args === undefined || isStringArray(value.args))
    );
  }

  if (value.transport === 'sse') {
    return typeof value.url === 'string' && value.url.trim().length > 0;
  }

  return false;
}

function sanitizeLocalConfig(config: LocalMcpServerConfig): LocalMcpServerConfig {
  if (config.transport === 'stdio') {
    const command = config.command.trim();
    const args =
      config.args?.map((item) => item.trim()).filter((item) => item.length > 0) ?? undefined;

    return {
      transport: 'stdio',
      command,
      ...(args && args.length > 0 ? { args } : {}),
    };
  }

  return {
    transport: 'sse',
    url: config.url.trim(),
  };
}

export function getLocalMcpServersPath(): string {
  return LOCAL_MCP_SERVERS_PATH;
}

export async function readLocalMcpServers(): Promise<LocalMcpServers> {
  try {
    const raw = await readFile(LOCAL_MCP_SERVERS_PATH, 'utf8');
    if (!raw.trim()) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isObjectRecord(parsed)) {
      throw new Error('Local MCP servers file must be a JSON object.');
    }

    const servers: LocalMcpServers = {};
    for (const [name, config] of Object.entries(parsed)) {
      if (!isLocalMcpServerConfig(config)) {
        throw new Error(`Invalid MCP server configuration for "${name}".`);
      }
      servers[name] = sanitizeLocalConfig(config);
    }

    return servers;
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    if (code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export async function writeLocalMcpServers(servers: LocalMcpServers): Promise<void> {
  await writeFile(LOCAL_MCP_SERVERS_PATH, `${JSON.stringify(servers, null, 2)}\n`, 'utf8');
}

export async function addLocalMcpServer(name: string, config: LocalMcpServerConfig): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Server name is required.');
  }
  if (!isLocalMcpServerConfig(config)) {
    throw new Error('Invalid MCP server configuration.');
  }

  const current = await readLocalMcpServers();
  current[normalizedName] = sanitizeLocalConfig(config);
  await writeLocalMcpServers(current);
}

export async function removeLocalMcpServer(name: string): Promise<void> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return;
  }

  const current = await readLocalMcpServers();
  if (!(normalizedName in current)) {
    return;
  }

  delete current[normalizedName];
  await writeLocalMcpServers(current);
}

export async function getEffectiveMcpServers(baseConfig: EffectiveMcpServers): Promise<EffectiveMcpServers> {
  const localServers = await readLocalMcpServers();
  return {
    ...baseConfig,
    ...localServers,
  };
}
