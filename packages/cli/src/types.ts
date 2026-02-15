export type LLMProvider = 'anthropic' | 'openai' | 'ollama';

export type AgentMode = 'single' | 'multi';

export type SupportedPackageManager = 'pnpm' | 'npm' | 'yarn';

export interface InstallConfig {
    provider: LLMProvider;
    apiKey: string;
    ollamaHost: string;
    includeMcpDashboard: boolean;
    includeExampleTools: boolean;
    agentMode: AgentMode;
    chatRoute: string;
}

export interface ManagedFileMetadata {
    sha256: string;
    strategy: 'overwrite' | 'merge-env';
}

export interface HexosManifest {
    schemaVersion: 1;
    installedAt: string;
    updatedAt: string;
    hexosVersion: string;
    installConfig: InstallConfig;
    managedFiles: Record<string, ManagedFileMetadata>;
}

export interface PlannedFile {
    relativePath: string;
    content: string;
    strategy: 'overwrite' | 'merge-env';
}

export interface FileWriteAction {
    relativePath: string;
    content: string;
    strategy: 'overwrite' | 'merge-env';
    changed: boolean;
    reason: 'create' | 'update' | 'unchanged';
}
