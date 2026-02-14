export type LLMProvider = 'anthropic' | 'openai' | 'ollama';

export interface AgentDefinition {
    id: string;
    name: string;
    description: string;
    canHandoffTo?: string[];
}

export interface FileSources {
    packageJsonSource: string;
    envSource: string;
    envExampleSource: string;
    layoutSource: string;
    sharedRuntimeSource: string;
    pageSource: string;
}

export interface UserResponses extends FileSources {
    projectName: string;
    appTitle: string;
    appDescription: string;
    llmProvider: LLMProvider;
    apiKey: string;
    ollamaHost: string;
    includeMcpDashboard: boolean;
    includeExampleTools: boolean;
    agents: AgentDefinition[];
}

export type PackageManager = 'pnpm' | 'npm';

export type CliLogLevel = 'silent' | 'info' | 'verbose';
