import { confirm, select, text } from '@clack/prompts';
import Handlebars from 'handlebars';
import fs from 'fs-extra';
import path from 'path';

import { checkCancel } from './helpers';
import {
    DEFAULT_OLLAMA_HOST,
    HEXOS_VERSION,
} from './constants';
import type { AgentDefinition, FileSources, LLMProvider, PackageManager, UserResponses } from './types';

interface GatherAnswers {
    appTitle: string;
    appDescription: string;
    llmProvider: LLMProvider;
    apiKey: string;
    ollamaHost: string;
    includeMcpDashboard: boolean;
    includeExampleTools: boolean;
    agents: AgentDefinition[];
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

export async function gatherUserResponses(
    root: string,
    _packageManager: PackageManager,
): Promise<UserResponses> {
    const projectName = path.basename(root);

    // 1. App title
    const appTitle = await text({
        message: 'What is your app title?',
        initialValue: projectName,
    });
    checkCancel(appTitle);

    // 2. App description
    const appDescription = await text({
        message: 'Short description of your app?',
        initialValue: 'An AI chat application built with Hexos',
    });
    checkCancel(appDescription);

    // 3. LLM provider
    const llmProvider = (await select({
        message: 'Which LLM provider will you use?',
        options: [
            { label: 'Anthropic (Claude)', value: 'anthropic' },
            { label: 'OpenAI (GPT)', value: 'openai' },
            { label: 'Ollama (local)', value: 'ollama', hint: 'Requires Ollama running locally' },
        ],
        initialValue: 'anthropic',
    })) as LLMProvider;
    checkCancel(llmProvider);

    // 4. API key or Ollama host
    let apiKey = '';
    let ollamaHost = DEFAULT_OLLAMA_HOST;

    if (llmProvider === 'ollama') {
        const ollamaHostResponse = await text({
            message: 'Ollama host URL?',
            initialValue: DEFAULT_OLLAMA_HOST,
        });
        checkCancel(ollamaHostResponse);
        ollamaHost = ollamaHostResponse as string;
    } else {
        const providerName = llmProvider === 'anthropic' ? 'Anthropic' : 'OpenAI';
        const apiKeyResponse = await text({
            message: `${providerName} API key (will be saved to .env)?`,
            placeholder: 'sk-...  (or leave blank to fill in .env later)',
        });
        checkCancel(apiKeyResponse);
        apiKey = (apiKeyResponse as string) || '';
    }

    // 5. Include MCP dashboard?
    const includeMcpDashboard = (await select({
        message: 'Include MCP server management dashboard?',
        options: [
            { label: 'No', value: false, hint: 'Simple chat interface' },
            { label: 'Yes', value: true, hint: 'Adds a left-panel UI to manage MCP server connections' },
        ],
        initialValue: false,
    })) as boolean;
    checkCancel(includeMcpDashboard);

    // 6. Agent setup
    const agentSetup = (await select({
        message: 'Agent setup?',
        options: [
            { label: 'Single agent', value: 'single', hint: 'One main agent handles everything' },
            {
                label: 'Multi-agent (orchestrator + specialist)',
                value: 'multi',
                hint: 'Orchestrator delegates to specialist agents with handoffs',
            },
        ],
        initialValue: 'single',
    })) as 'single' | 'multi';
    checkCancel(agentSetup);

    // 7. Include example tools?
    const includeExampleTools = (await confirm({
        message: 'Include example tools? (get_current_time, calculate)',
        initialValue: true,
    })) as boolean;
    checkCancel(includeExampleTools);

    const agents: AgentDefinition[] =
        agentSetup === 'multi'
            ? [
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
              ]
            : [{ id: 'main', name: 'Assistant', description: 'Main AI assistant' }];

    const answers: GatherAnswers = {
        appTitle: appTitle as string,
        appDescription: appDescription as string,
        llmProvider,
        apiKey,
        ollamaHost,
        includeMcpDashboard,
        includeExampleTools,
        agents,
    };

    const fileSources = await generateFileSources(root, answers);

    return {
        ...fileSources,
        projectName,
        ...answers,
    };
}

export async function getCiConfiguration(
    root: string,
    _packageManager: PackageManager,
): Promise<UserResponses> {
    const projectName = path.basename(root);
    const answers: GatherAnswers = {
        appTitle: projectName,
        appDescription: 'An AI chat application built with Hexos',
        llmProvider: 'openai',
        apiKey: '',
        ollamaHost: DEFAULT_OLLAMA_HOST,
        includeMcpDashboard: false,
        includeExampleTools: true,
        agents: [{ id: 'main', name: 'Assistant', description: 'Main AI assistant' }],
    };

    const fileSources = await generateFileSources(root, answers);

    return {
        ...fileSources,
        projectName,
        ...answers,
    };
}

async function generateFileSources(root: string, answers: GatherAnswers): Promise<FileSources> {
    const assetPath = (fileName: string) => path.join(__dirname, '../assets', fileName);

    const providerConfig = PROVIDER_CONFIG[answers.llmProvider];

    const templateContext = {
        projectName: path.basename(root),
        appTitle: answers.appTitle,
        appDescription: answers.appDescription,
        llmProvider: answers.llmProvider,
        isAnthropic: answers.llmProvider === 'anthropic',
        isOpenAI: answers.llmProvider === 'openai',
        isOllama: answers.llmProvider === 'ollama',
        apiKey: answers.apiKey,
        ollamaHost: answers.ollamaHost,
        hexosVersion: HEXOS_VERSION,
        includeMcpDashboard: answers.includeMcpDashboard,
        includeExampleTools: answers.includeExampleTools,
        isMultiAgent: answers.agents.length > 1,
        providerEnum: providerConfig.providerEnum,
        modelConst: providerConfig.modelConst,
        modelImport: providerConfig.modelImport,
        defaultAgentId: answers.agents[0].id,
        agents: answers.agents.map((agent, i) => ({
            ...agent,
            isDefault: i === 0,
            hasTools: i === 0,
            canHandoffToStr: agent.canHandoffTo
                ? agent.canHandoffTo.map(id => `'${id}'`).join(', ')
                : '',
        })),
        agentIds: answers.agents.map(a => `'${a.id}'`).join(', '),
    };

    const compile = async (templateFile: string): Promise<string> => {
        const templateSrc = await fs.readFile(assetPath(templateFile), 'utf-8');
        const template = Handlebars.compile(templateSrc, { noEscape: true });
        return template(templateContext);
    };

    const pageTemplate = answers.includeMcpDashboard ? 'page-with-mcp.hbs' : 'page-simple.hbs';

    const [
        packageJsonSource,
        envSource,
        envExampleSource,
        layoutSource,
        sharedRuntimeSource,
        pageSource,
    ] = await Promise.all([
        compile('package.json.hbs'),
        compile('env.hbs'),
        compile('env-example.hbs'),
        compile('layout.hbs'),
        compile('shared-runtime.hbs'),
        compile(pageTemplate),
    ]);

    return {
        packageJsonSource,
        envSource,
        envExampleSource,
        layoutSource,
        sharedRuntimeSource,
        pageSource,
    };
}
