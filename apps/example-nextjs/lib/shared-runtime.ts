import {
  AgentRuntime,
  LLMProvider,
  OpenAIModel,
  type RuntimeConfig,
  type ToolContext,
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
      // Main orchestrator agent
      {
        id: 'main',
        name: 'Orquestrador',
        description: 'Assistente principal que coordena outros agentes especialistas',
        model: {
          provider: LLMProvider.OpenAI,
          model: OpenAIModel.GPT4oMini,
        },
        systemPrompt: `Você é um assistente orquestrador chamado "Orquestrador".

Suas responsabilidades:
- Para perguntas gerais, responda diretamente
- Para tarefas de CÓDIGO (criar funções, debug, programação), use handoff_to_code
- Para perguntas sobre HORA/DATA ou CÁLCULOS, use as tools disponíveis
- Para ENVIAR EMAILS, use a tool send_email (requer aprovação do usuário)
- Para ADICIONAR ITENS À LISTA de tarefas, use a tool add_todo_item
- Para ALTERNAR O TEMA (dark/light mode), use a tool toggle_theme
- Para LER ou LISTAR ARQUIVOS na pasta public, use as tools do filesystem MCP

As tools add_todo_item e toggle_theme são executadas no frontend e atualizam a interface imediatamente.

Seja conciso e amigável. Quando delegar, explique brevemente o motivo.`,
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
                return { error: 'Expressão inválida' };
              }
            },
          },
          {
            name: 'send_email',
            description: 'Send an email to someone. May require user approval depending on client settings.',
            inputSchema: z.object({
              to: z.string().describe('Email recipient'),
              subject: z.string().describe('Email subject'),
              body: z.string().describe('Email body content'),
            }),
            // Dynamic approval based on client configuration
            // If client hasn't set a preference, defaults to requiring approval
            requiresApproval: (context: ToolContext) => {
              const clientConfig = context.frontendContext as
                | { requireToolApproval?: boolean }
                | undefined;
              // Default to true (require approval) if not explicitly set to false
              return clientConfig?.requireToolApproval !== false;
            },
            execute: async (input) => {
              const { to, subject, body } = input as { to: string; subject: string; body: string };
              // Simulated email sending
              console.log(`[Email] Sending to: ${to}, Subject: ${subject}`);
              return {
                success: true,
                message: `Email sent to ${to} with subject "${subject}"`,
                preview: body.substring(0, 100) + (body.length > 100 ? '...' : ''),
              };
            },
          },
          // Frontend actions - these are executed in the browser
          // The execute function here is a no-op; the actual execution happens in the frontend
          {
            name: 'add_todo_item',
            description:
              'Add a new item to the todo list. This action updates the UI immediately with optimistic updates.',
            inputSchema: z.object({
              title: z.string().describe('Title of the todo item'),
              priority: z.enum(['low', 'medium', 'high']).optional().describe('Priority level'),
            }),
            execute: async (input) => {
              // This is a frontend action - the actual execution happens in the browser
              // The frontend will intercept this tool call and execute it locally
              return {
                success: true,
                message: 'Item added to todo list',
                item: input,
              };
            },
          },
          {
            name: 'toggle_theme',
            description: 'Toggle between light and dark theme. Updates the UI immediately.',
            inputSchema: z.object({}),
            execute: async () => {
              // Frontend action - executed in the browser
              return {
                success: true,
                message: 'Theme toggled',
              };
            },
          },
        ],
        canHandoffTo: ['code'],
        maxIterations: 5,
      },

      // Code specialist agent
      {
        id: 'code',
        name: 'Programador',
        description: 'Especialista em programação, cria e explica código',
        model: {
          provider: LLMProvider.OpenAI,
          model: OpenAIModel.GPT4oMini,
        },
        systemPrompt: `Você é um especialista em programação chamado "Programador".

Suas responsabilidades:
- Criar funções e código em qualquer linguagem
- Explicar conceitos de programação
- Debugar e corrigir código
- Sugerir melhores práticas

Quando terminar a tarefa de código, use handoff_to_main para devolver ao orquestrador.
Seja técnico mas acessível. Inclua exemplos de código quando apropriado.`,
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
                // Safe eval for demo purposes only
                const result = Function(`"use strict"; return (${code})`)();
                return { success: true, result: String(result) };
              } catch (error) {
                return {
                  success: false,
                  error: error instanceof Error ? error.message : 'Erro ao executar',
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
