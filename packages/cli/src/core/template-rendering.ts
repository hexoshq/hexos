import fs from 'fs-extra';
import Handlebars from 'handlebars';
import path from 'path';

import { DEFAULT_OLLAMA_HOST } from '../constants';
import { AgentMode, InstallConfig, LLMProvider, PlannedFile } from '../types';

interface AgentDefinition {
    id: string;
    name: string;
    description: string;
    canHandoffTo?: string[];
}

const PROVIDER_CONFIG: Record<
    LLMProvider,
    { providerEnum: string; modelConst: string; modelImport: string }
> = {
    anthropic: {
        providerEnum: 'Anthropic',
        modelConst: 'AnthropicModel.Claude4Sonnet',
        modelImport: 'AnthropicModel',
    },
    openai: {
        providerEnum: 'OpenAI',
        modelConst: 'OpenAIModel.GPT4oMini',
        modelImport: 'OpenAIModel',
    },
    ollama: {
        providerEnum: 'Ollama',
        modelConst: 'OllamaModel.Llama32',
        modelImport: 'OllamaModel',
    },
};

export async function generateInstallFiles(options: {
    projectName: string;
    installConfig: InstallConfig;
    appDescription?: string;
}): Promise<PlannedFile[]> {
    const assetsRoot = resolveCreateAssetsRoot();
    const chatRoute = normalizeChatRoute(options.installConfig.chatRoute);
    const agents = getAgents(options.installConfig.agentMode);
    const provider = options.installConfig.provider;
    const providerConfig = PROVIDER_CONFIG[provider];

    const templateContext = {
        projectName: options.projectName,
        appTitle: toTitle(options.projectName),
        appDescription: options.appDescription ?? 'AI chat powered by Hexos',
        llmProvider: provider,
        isAnthropic: provider === 'anthropic',
        isOpenAI: provider === 'openai',
        isOllama: provider === 'ollama',
        apiKey: options.installConfig.apiKey,
        ollamaHost: options.installConfig.ollamaHost || DEFAULT_OLLAMA_HOST,
        hexosVersion: 'managed-by-cli',
        includeMcpDashboard: options.installConfig.includeMcpDashboard,
        includeExampleTools: options.installConfig.includeExampleTools,
        isMultiAgent: agents.length > 1,
        providerEnum: providerConfig.providerEnum,
        modelConst: providerConfig.modelConst,
        modelImport: providerConfig.modelImport,
        defaultAgentId: agents[0].id,
        agents: agents.map((agent, index) => ({
            ...agent,
            isDefault: index === 0,
            hasTools: index === 0,
            canHandoffToStr: agent.canHandoffTo
                ? agent.canHandoffTo.map(id => `'${id}'`).join(', ')
                : '',
        })),
        agentIds: agents.map(agent => `'${agent.id}'`).join(', '),
    };

    const pageTemplateName = options.installConfig.includeMcpDashboard
        ? 'page-with-mcp.hbs'
        : 'page-simple.hbs';

    const [
        sharedRuntimeSource,
        pageSource,
        envSource,
        envExampleSource,
        chatRouteSource,
        approveRouteSource,
        mcpRouteSource,
        mcpServerStoreSource,
    ] = await Promise.all([
        compileTemplate(path.join(assetsRoot, 'shared-runtime.hbs'), templateContext),
        compileTemplate(path.join(assetsRoot, pageTemplateName), templateContext),
        compileTemplate(path.join(assetsRoot, 'env.hbs'), templateContext),
        compileTemplate(path.join(assetsRoot, 'env-example.hbs'), templateContext),
        fs.readFile(path.join(assetsRoot, 'static', 'chat-route.ts'), 'utf8'),
        fs.readFile(path.join(assetsRoot, 'static', 'approve-route.ts'), 'utf8'),
        fs.readFile(path.join(assetsRoot, 'static', 'mcp-route.ts'), 'utf8'),
        fs.readFile(path.join(assetsRoot, 'static', 'mcp-server-store.ts'), 'utf8'),
    ]);

    const files: PlannedFile[] = [
        {
            relativePath: 'app/api/agent/chat/route.ts',
            content: chatRouteSource.replace("@/lib/shared-runtime", '../../../../lib/shared-runtime'),
            strategy: 'overwrite',
        },
        {
            relativePath: 'app/api/agent/chat/approve/route.ts',
            content: approveRouteSource.replace("@/lib/shared-runtime", '../../../../../lib/shared-runtime'),
            strategy: 'overwrite',
        },
        {
            relativePath: 'lib/shared-runtime.ts',
            content: sharedRuntimeSource,
            strategy: 'overwrite',
        },
        {
            relativePath: `app/${chatRoute}/page.tsx`,
            content: pageSource,
            strategy: 'overwrite',
        },
        {
            relativePath: '.env',
            content: envSource,
            strategy: 'merge-env',
        },
        {
            relativePath: '.env.example',
            content: envExampleSource,
            strategy: 'merge-env',
        },
    ];

    if (options.installConfig.includeMcpDashboard) {
        files.push(
            {
                relativePath: 'app/api/mcp/route.ts',
                content: mcpRouteSource
                    .replace("@/lib/shared-runtime", '../../../lib/shared-runtime')
                    .replace("@/lib/mcp-server-store", '../../../lib/mcp-server-store'),
                strategy: 'overwrite',
            },
            {
                relativePath: 'lib/mcp-server-store.ts',
                content: mcpServerStoreSource,
                strategy: 'overwrite',
            },
            {
                relativePath: '.mcp-servers.local.json',
                content: '{}\n',
                strategy: 'overwrite',
            },
        );
    }

    return files.map(file => ({
        ...file,
        content: ensureTrailingNewline(file.content),
    }));
}

function resolveCreateAssetsRoot(): string {
    const createPackagePath = require.resolve('@hexos/create/package.json');
    const packageDir = path.dirname(createPackagePath);
    const assetsDir = path.join(packageDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
        throw new Error(`Could not resolve @hexos/create assets at ${assetsDir}.`);
    }
    return assetsDir;
}

function getAgents(mode: AgentMode): AgentDefinition[] {
    if (mode === 'multi') {
        return [
            {
                id: 'main',
                name: 'Orchestrator',
                description: 'Main orchestrator agent that coordinates other agents',
                canHandoffTo: ['specialist'],
            },
            {
                id: 'specialist',
                name: 'Specialist',
                description: 'Specialist agent for complex tasks',
                canHandoffTo: ['main'],
            },
        ];
    }

    return [{ id: 'main', name: 'Assistant', description: 'Main AI assistant' }];
}

async function compileTemplate(templatePath: string, context: Record<string, unknown>): Promise<string> {
    const templateSource = await fs.readFile(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource, { noEscape: true });
    return template(context);
}

function normalizeChatRoute(route: string): string {
    const normalized = route
        .trim()
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .replace(/[^A-Za-z0-9/_-]/g, '')
        .replace(/\/+/g, '/');

    return normalized.length > 0 ? normalized : 'chat';
}

function toTitle(projectName: string): string {
    return projectName
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function ensureTrailingNewline(content: string): string {
    return content.endsWith('\n') ? content : `${content}\n`;
}
