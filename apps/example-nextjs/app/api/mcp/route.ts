import { NextResponse } from 'next/server';
import {
  getEffectiveMcpServersConfig,
  getSharedRuntime,
  reloadSharedRuntime,
  RUNTIME_RELOAD_BLOCKED_PENDING_APPROVALS,
} from '@/lib/shared-runtime';
import {
  addLocalMcpServer,
  readLocalMcpServers,
  writeLocalMcpServers,
  type LocalMcpServerConfig,
  type LocalMcpServers,
} from '@/lib/mcp-server-store';

export interface MCPServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
  tools: string[];
  transport: 'stdio' | 'sse' | 'unknown';
  isLocal: boolean;
  command?: string;
  args?: string[];
  url?: string;
}

interface CreateMcpServerRequest {
  name?: unknown;
  transport?: unknown;
  command?: unknown;
  args?: unknown;
  url?: unknown;
  headers?: unknown;
}

interface UpdateMcpServerRequest extends CreateMcpServerRequest {
  originalName?: unknown;
}

interface DeleteMcpServerRequest {
  name?: unknown;
}

function resolveTransport(config: unknown): MCPServerStatus['transport'] {
  if (typeof config !== 'object' || config === null) {
    return 'unknown';
  }

  if ('transport' in config) {
    const transport = (config as { transport?: unknown }).transport;
    if (transport === 'stdio' || transport === 'sse') {
      return transport;
    }
  }

  if ('command' in config) {
    return 'stdio';
  }

  return 'unknown';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallback;
}

function parseName(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  return value.trim();
}

function parseLocalMcpServerConfig(body: CreateMcpServerRequest):
  | { ok: true; config: LocalMcpServerConfig }
  | { ok: false; error: string } {
  if (body.headers !== undefined) {
    return { ok: false, error: 'Custom SSE headers are not supported in this version.' };
  }

  if (body.transport !== 'stdio' && body.transport !== 'sse') {
    return { ok: false, error: 'Transport must be either "stdio" or "sse".' };
  }

  if (body.transport === 'stdio') {
    const command = typeof body.command === 'string' ? body.command.trim() : '';
    if (!command) {
      return { ok: false, error: 'Command is required for Standard IO.' };
    }

    if (body.args !== undefined && !isStringArray(body.args)) {
      return { ok: false, error: 'args must be an array of strings when provided.' };
    }

    const args = (body.args ?? []).map((item) => item.trim()).filter((item) => item.length > 0);

    return {
      ok: true,
      config: {
        transport: 'stdio',
        command,
        ...(args.length > 0 ? { args } : {}),
      },
    };
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    return { ok: false, error: 'URL is required for SSE.' };
  }

  return {
    ok: true,
    config: {
      transport: 'sse',
      url,
    },
  };
}

function extractConnectionDetails(config: unknown): Pick<MCPServerStatus, 'command' | 'args' | 'url'> {
  if (typeof config !== 'object' || config === null) {
    return {};
  }

  if ('transport' in config && (config as { transport?: unknown }).transport === 'sse') {
    const url = (config as { url?: unknown }).url;
    return typeof url === 'string' ? { url } : {};
  }

  const command = (config as { command?: unknown }).command;
  const args = (config as { args?: unknown }).args;

  return {
    ...(typeof command === 'string' ? { command } : {}),
    ...(isStringArray(args) ? { args } : {}),
  };
}

function hasPendingApprovalsMessage(): string {
  return 'Cannot modify MCP servers while there are pending tool approvals. Complete the current approval flow and try again.';
}

async function reloadRuntimeWithRollback(
  previousLocalServers: LocalMcpServers
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  try {
    await reloadSharedRuntime();
    return { ok: true };
  } catch (error) {
    try {
      await writeLocalMcpServers(previousLocalServers);
    } catch (rollbackError) {
      console.error('[MCP API] Failed to rollback local MCP servers file:', rollbackError);
    }

    const code = (error as { code?: string } | undefined)?.code;
    if (code === RUNTIME_RELOAD_BLOCKED_PENDING_APPROVALS) {
      return {
        ok: false,
        response: NextResponse.json({ error: hasPendingApprovalsMessage() }, { status: 409 }),
      };
    }

    console.error('[MCP API] Runtime reload failed:', error);
    return {
      ok: false,
      response: NextResponse.json({ error: 'Failed to apply MCP server changes.' }, { status: 500 }),
    };
  }
}

async function buildServerStatuses(): Promise<MCPServerStatus[]> {
  const runtime = await getSharedRuntime();
  const effectiveConfig = await getEffectiveMcpServersConfig();
  const localServers = await readLocalMcpServers();
  const mcpManager = runtime.getMCPManager();

  if (!mcpManager) {
    return [];
  }

  try {
    await runtime.initialize();
  } catch (error) {
    console.warn('[MCP API] Runtime initialize warning:', error);
  }

  const allTools = mcpManager.getAllTools();

  return Object.entries(effectiveConfig).map(([name, config]) => {
    const serverTools = allTools.filter((tool) => tool.serverName === name);

    return {
      name,
      connected: mcpManager.isServerConnected(name),
      toolCount: serverTools.length,
      tools: serverTools.map((tool) => tool.name),
      transport: resolveTransport(config),
      isLocal: name in localServers,
      ...extractConnectionDetails(config),
    };
  });
}

export async function GET() {
  try {
    const servers = await buildServerStatuses();
    return NextResponse.json({ servers });
  } catch (error) {
    console.error('[MCP API] Error:', error);
    return NextResponse.json({ servers: [], error: 'Failed to get MCP servers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: CreateMcpServerRequest;

  try {
    body = (await request.json()) as CreateMcpServerRequest;
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = parseName(body.name);
  if (!name) {
    return NextResponse.json({ error: 'Server name is required.' }, { status: 400 });
  }

  const parsedConfig = parseLocalMcpServerConfig(body);
  if (!parsedConfig.ok) {
    return NextResponse.json({ error: parsedConfig.error }, { status: 400 });
  }

  const runtime = await getSharedRuntime();
  if (runtime.getPendingApprovals().length > 0) {
    return NextResponse.json({ error: hasPendingApprovalsMessage() }, { status: 409 });
  }

  const effectiveConfig = await getEffectiveMcpServersConfig();
  if (name in effectiveConfig) {
    return NextResponse.json({ error: `Server name "${name}" already exists.` }, { status: 409 });
  }

  const previousLocalServers = await readLocalMcpServers();

  try {
    await addLocalMcpServer(name, parsedConfig.config);

    const reloadResult = await reloadRuntimeWithRollback(previousLocalServers);
    if (!reloadResult.ok) {
      return reloadResult.response;
    }

    const servers = await buildServerStatuses();
    return NextResponse.json({ server: { name, ...parsedConfig.config }, servers }, { status: 201 });
  } catch (error) {
    console.error('[MCP API] Error creating server:', error);
    return NextResponse.json(
      { error: toErrorMessage((error as { message?: unknown } | null)?.message, 'Failed to create MCP server') },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  let body: UpdateMcpServerRequest;

  try {
    body = (await request.json()) as UpdateMcpServerRequest;
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const originalName = parseName(body.originalName);
  if (!originalName) {
    return NextResponse.json({ error: 'originalName is required.' }, { status: 400 });
  }

  const name = parseName(body.name);
  if (!name) {
    return NextResponse.json({ error: 'Server name is required.' }, { status: 400 });
  }

  const parsedConfig = parseLocalMcpServerConfig(body);
  if (!parsedConfig.ok) {
    return NextResponse.json({ error: parsedConfig.error }, { status: 400 });
  }

  const runtime = await getSharedRuntime();
  if (runtime.getPendingApprovals().length > 0) {
    return NextResponse.json({ error: hasPendingApprovalsMessage() }, { status: 409 });
  }

  const previousLocalServers = await readLocalMcpServers();
  if (!(originalName in previousLocalServers)) {
    return NextResponse.json(
      { error: `Server "${originalName}" is not editable because it is not a local MCP server.` },
      { status: 404 }
    );
  }

  const effectiveConfig = await getEffectiveMcpServersConfig();
  if (name !== originalName && name in effectiveConfig) {
    return NextResponse.json({ error: `Server name "${name}" already exists.` }, { status: 409 });
  }

  const nextLocalServers: LocalMcpServers = { ...previousLocalServers };
  delete nextLocalServers[originalName];
  nextLocalServers[name] = parsedConfig.config;

  try {
    await writeLocalMcpServers(nextLocalServers);

    const reloadResult = await reloadRuntimeWithRollback(previousLocalServers);
    if (!reloadResult.ok) {
      return reloadResult.response;
    }

    const servers = await buildServerStatuses();
    return NextResponse.json({ server: { name, ...parsedConfig.config }, servers });
  } catch (error) {
    console.error('[MCP API] Error updating server:', error);
    return NextResponse.json(
      { error: toErrorMessage((error as { message?: unknown } | null)?.message, 'Failed to update MCP server') },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  let body: DeleteMcpServerRequest;

  try {
    body = (await request.json()) as DeleteMcpServerRequest;
  } catch (_error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = parseName(body.name);
  if (!name) {
    return NextResponse.json({ error: 'Server name is required.' }, { status: 400 });
  }

  const runtime = await getSharedRuntime();
  if (runtime.getPendingApprovals().length > 0) {
    return NextResponse.json({ error: hasPendingApprovalsMessage() }, { status: 409 });
  }

  const previousLocalServers = await readLocalMcpServers();
  if (!(name in previousLocalServers)) {
    return NextResponse.json(
      { error: `Server "${name}" is not deletable because it is not a local MCP server.` },
      { status: 404 }
    );
  }

  const nextLocalServers: LocalMcpServers = { ...previousLocalServers };
  delete nextLocalServers[name];

  try {
    await writeLocalMcpServers(nextLocalServers);

    const reloadResult = await reloadRuntimeWithRollback(previousLocalServers);
    if (!reloadResult.ok) {
      return reloadResult.response;
    }

    const servers = await buildServerStatuses();
    return NextResponse.json({ success: true, servers });
  } catch (error) {
    console.error('[MCP API] Error deleting server:', error);
    return NextResponse.json(
      { error: toErrorMessage((error as { message?: unknown } | null)?.message, 'Failed to delete MCP server') },
      { status: 500 }
    );
  }
}
