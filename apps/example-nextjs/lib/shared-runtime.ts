import {
  AgentRuntime,
  LLMProvider,
  OpenAIModel,
  type RuntimeConfig,
} from '@hexos/runtime';

import { z } from 'zod';
import { getEffectiveMcpServers } from './mcp-server-store';

// Singleton runtime instance
let runtimeInstance: AgentRuntime | null = null;
let runtimeCreationPromise: Promise<AgentRuntime> | null = null;

export const MCP_SERVERS_CONFIG: NonNullable<RuntimeConfig['mcpServers']> = {
  // filesystem: {
  //   command: 'npx',
  //   args: ['-y', '@modelcontextprotocol/server-filesystem', path.resolve(process.cwd(), 'public')],
  // },
  // 'example-nestjs': {
  //   transport: 'sse',
  //   url: 'http://localhost:3000/mcp/sse',
  //   headers: { Authorization: 'Bearer xxx' },
  // },
};

export const RUNTIME_RELOAD_BLOCKED_PENDING_APPROVALS = 'RUNTIME_RELOAD_BLOCKED_PENDING_APPROVALS';

export class RuntimeReloadBlockedError extends Error {
  code = RUNTIME_RELOAD_BLOCKED_PENDING_APPROVALS;

  constructor(message = 'Cannot reload runtime while there are pending approvals.') {
    super(message);
    this.name = 'RuntimeReloadBlockedError';
  }
}

function createRuntime(mcpServers: NonNullable<RuntimeConfig['mcpServers']>): AgentRuntime {
  return new AgentRuntime({
    mcpServers,

    agents: [
      // Hexos Expert agent - knows the project inside and out
      {
        id: 'main',
        name: 'Hexos Expert',
        description: 'AI specialist on the Hexos framework, its architecture, and how to use it',
        model: {
          provider: LLMProvider.OpenAI,
          model: OpenAIModel.GPT4oMini,
        },
        systemPrompt: `You are "Hexos Expert", an AI specialist on the Hexos project — a React library for building AI agent chat applications.

You have deep knowledge of the project architecture and should help developers understand and use it.

## Project Overview
Hexos is a pnpm monorepo with Turborepo orchestration:

**Packages:**
- \`@hexos/common\` — Shared types, enums (LLMProvider, model enums), and utilities
- \`@hexos/react-core\` — React hooks and Jotai atoms for state management. Key exports: \`useAgent()\`, \`useAgentTool()\`, \`useAgentContext()\`, \`useAgentAction()\`, \`useToolApproval()\`, \`AgentProvider\`. Atoms: \`messagesAtom\`, \`isStreamingAtom\`, \`activeAgentAtom\`, \`pendingApprovalsAtom\`
- \`@hexos/react-ui\` — Pre-built chat UI components: \`ChatWindow\`, \`ToolApprovalContainer\`, \`AgentUIProvider\`. Depends on react-core
- \`@hexos/runtime\` — Server-side agent runtime. \`AgentRuntime\` class orchestrates LLM calls and tool execution. Supports Anthropic, OpenAI, Ollama, Google, and Azure providers. Features: multi-agent swarm with handoffs, MCP client support, human-in-the-loop approval

**Data Flow:**
1. User input → \`useAgent().sendMessage()\` → SSE POST to server endpoint
2. \`AgentRuntime.stream()\` → LLM provider → yields \`RuntimeEvent\`s
3. Events streamed via SSE → Jotai atoms updated
4. React re-renders with new messages/tool calls

**Key Concepts:**
- **Agents**: Each agent has an id, name, model config, system prompt, tools, and can hand off to other agents
- **Tools**: Defined with Zod schemas, can require human approval (static or dynamic)
- **Handoffs**: Multi-agent swarm pattern — agents declare \`canHandoffTo\` and get auto-generated \`handoff_to_<agent>\` tools
- **MCP**: Model Context Protocol support via stdio or SSE transport for external tool servers
- **Frontend Actions**: Tools that execute in the browser via \`useAgentAction()\` hook
- **SSE Transport**: Real-time streaming from server to client

## Your Responsibilities
- Answer questions about Hexos architecture, packages, and concepts
- Explain how to set up and configure the framework
- Guide developers through common patterns (creating agents, defining tools, setting up MCP, etc.)
- For CODE examples and implementation details, use handoff_to_code to delegate to the Code Expert
- For date/time or calculations, use the available tools
- For reading/listing files from the public folder, use filesystem MCP tools if available

Be friendly, clear, and concise. When delegating to the Code Expert, briefly explain why.`,
        allowedMcpServers: ['filesystem', 'example-nestjs'],
        tools: [
          {
            name: 'get_current_time',
            description: 'Get the current date and time',
            inputSchema: z.object({
              timezone: z.string().optional().describe('Timezone (e.g., "America/Sao_Paulo")'),
            }),
            execute: async (input) => {
              const { timezone } = input as { timezone?: string };
              const now = new Date();
              return {
                timestamp: now.toISOString(),
                formatted: now.toLocaleString('pt-BR', {
                  timeZone: timezone ?? 'America/Sao_Paulo',
                }),
              };
            },
          },
          {
            name: 'calculate',
            description: 'Perform a mathematical calculation',
            inputSchema: z.object({
              expression: z.string().describe('Mathematical expression to evaluate'),
            }),
            execute: async (input) => {
              const { expression } = input as { expression: string };
              try {
                const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
                const result = Function(`"use strict"; return (${sanitized})`)();
                return { result, expression };
              } catch (_error) {
                return { error: 'Invalid expression' };
              }
            },
          },
        ],
        canHandoffTo: ['code'],
        maxIterations: 5,
      },

      // Code Expert agent - shows code examples for Hexos
      {
        id: 'code',
        name: 'Code Expert',
        description: 'Specialist in Hexos code examples, implementation patterns, and best practices',
        model: {
          provider: LLMProvider.OpenAI,
          model: OpenAIModel.GPT4oMini,
        },
        systemPrompt: `You are "Code Expert", a coding specialist for the Hexos framework.

You help developers write code using Hexos packages. You know:

- How to set up \`AgentRuntime\` with agents, tools, and MCP servers
- How to define tools with Zod schemas and approval flows
- How to use React hooks: \`useAgent()\`, \`useAgentTool()\`, \`useAgentAction()\`, \`useToolApproval()\`
- How to configure \`AgentProvider\` and \`ChatWindow\` components
- How to implement multi-agent handoffs
- How to set up SSE streaming endpoints (Next.js, NestJS)
- How to integrate MCP servers (stdio and SSE transport)

When showing code examples:
- Use TypeScript
- Use ESM imports
- Use Zod for schemas
- Follow the patterns established in the Hexos codebase

When done with a coding task, use handoff_to_main to return to the Hexos Expert.`,
        tools: [
          {
            name: 'run_code',
            description: 'Execute JavaScript code and return the result',
            inputSchema: z.object({
              code: z.string().describe('JavaScript code to execute'),
            }),
            execute: async (input) => {
              const { code } = input as { code: string };
              try {
                const result = Function(`"use strict"; return (${code})`)();
                return { success: true, result: String(result) };
              } catch (error) {
                return {
                  success: false,
                  error: error instanceof Error ? error.message : 'Execution error',
                };
              }
            },
          },
        ],
        canHandoffTo: ['main'],
        maxIterations: 5,
      },
    ],
    defaultAgent: 'main',
    hooks: {
      onAgentStart: (agentId) => {
        console.log(`[Hexos] Agent started: ${agentId}`);
      },
      onAgentEnd: (agentId) => {
        console.log(`[Hexos] Agent ended: ${agentId}`);
      },
      onHandoff: (from, to, reason) => {
        console.log(`[Hexos] Handoff: ${from} → ${to} (${reason})`);
      },
      onToolCall: (toolName, args) => {
        console.log(`[Hexos] Tool called: ${toolName}`, args);
      },
      onError: (error) => {
        console.error(`[Hexos] Error:`, error);
      },
    },
    debug: process.env.NODE_ENV === 'development',
  });
}

export async function getEffectiveMcpServersConfig(): Promise<NonNullable<RuntimeConfig['mcpServers']>> {
  return getEffectiveMcpServers(MCP_SERVERS_CONFIG);
}

function runtimeHasPendingApprovals(runtime: AgentRuntime): boolean {
  return runtime.getPendingApprovals().length > 0;
}

/**
 * Get the shared AgentRuntime instance.
 * This ensures the same runtime (with its pending approvals) is used across routes.
 */
export async function getSharedRuntime(): Promise<AgentRuntime> {
  if (runtimeInstance) {
    return runtimeInstance;
  }

  if (runtimeCreationPromise) {
    return runtimeCreationPromise;
  }

  runtimeCreationPromise = (async () => {
    const effectiveMcpServers = await getEffectiveMcpServersConfig();
    const runtime = createRuntime(effectiveMcpServers);
    runtimeInstance = runtime;
    return runtime;
  })();

  try {
    return await runtimeCreationPromise;
  } finally {
    runtimeCreationPromise = null;
  }
}

export async function reloadSharedRuntime(): Promise<AgentRuntime> {
  if (!runtimeInstance && runtimeCreationPromise) {
    await runtimeCreationPromise;
  }

  if (runtimeInstance && runtimeHasPendingApprovals(runtimeInstance)) {
    throw new RuntimeReloadBlockedError();
  }

  if (runtimeInstance) {
    await runtimeInstance.shutdown();
  }

  const effectiveMcpServers = await getEffectiveMcpServersConfig();
  runtimeInstance = createRuntime(effectiveMcpServers);
  runtimeCreationPromise = null;
  return runtimeInstance;
}
