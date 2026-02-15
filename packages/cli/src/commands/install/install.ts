import {
    cancel,
    confirm,
    intro,
    isCancel,
    note,
    outro,
    select,
    spinner,
    text,
} from '@clack/prompts';
import fs from 'fs-extra';
import path from 'path';

import {
    buildFileActionPlan,
    getSkippedConflictPaths,
    getWritablePlans,
    resolveConflicts,
} from '../../core/conflict-resolution';
import { buildManagedMetadata, readManifest, writeManifest } from '../../core/manifest';
import { detectPackageManager, installDependencies } from '../../core/package-manager';
import { assertNextAppRouterProject, assertNodeVersion } from '../../core/project-detection';
import { generateInstallFiles } from '../../core/template-rendering';
import { getDefaultHexosVersion } from '../../core/versioning';
import {
    DEFAULT_OLLAMA_HOST,
    HEXOS_DEPENDENCIES,
    OPTIONAL_PROVIDER_DEPENDENCIES,
    SUPPORT_MESSAGE,
} from '../../constants';
import { HexosManifest, InstallConfig, LLMProvider, SupportedPackageManager } from '../../types';

export interface InstallCommandOptions {
    provider?: LLMProvider;
    apiKey?: string;
    ollamaHost?: string;
    mcpDashboard?: boolean;
    exampleTools?: boolean;
    agents?: 'single' | 'multi';
    chatRoute?: string;
    yes?: boolean;
    force?: boolean;
    dryRun?: boolean;
    packageManager?: SupportedPackageManager;
}

export async function installCommand(projectPath: string | undefined, options: InstallCommandOptions) {
    assertNodeVersion();

    const nonInteractive = Boolean(options.yes || process.env.CI === 'true');
    const projectInfo = await assertNextAppRouterProject(projectPath);
    const projectName = extractProjectName(projectInfo.packageJson.name, projectInfo.rootDir);
    const chatRoute = normalizeChatRoute(options.chatRoute ?? 'chat');

    const existingManifest = await readManifest(projectInfo.rootDir);
    if (existingManifest) {
        throw new Error(
            'Hexos manifest already exists. Use `hexos upgrade` to update this installation.',
        );
    }

    intro(`Hexos install in ${projectInfo.rootDir}`);

    const installConfig = await gatherInstallConfig({
        provider: options.provider,
        apiKey: options.apiKey,
        ollamaHost: options.ollamaHost,
        includeMcpDashboard: options.mcpDashboard,
        includeExampleTools: options.exampleTools,
        agentMode: options.agents,
        chatRoute,
        nonInteractive,
    });

    const packageManager = detectPackageManager(projectInfo.rootDir, options.packageManager);
    const hexosVersion = getDefaultHexosVersion();

    const plannedFiles = await generateInstallFiles({
        projectName,
        installConfig,
        appDescription: projectInfo.packageJson.description,
    });

    const plans = await buildFileActionPlan({
        projectRoot: projectInfo.rootDir,
        plannedFiles,
        mode: 'install',
        manifest: null,
        force: options.force,
    });

    const resolution = await resolveConflicts({
        plans,
        nonInteractive,
        force: options.force,
    });

    const writablePlans = getWritablePlans(plans, resolution);
    const skippedConflictPaths = getSkippedConflictPaths(plans, resolution);

    const dependencies = buildDependencies(hexosVersion, installConfig.provider);

    if (options.dryRun) {
        note(
            [
                `Package manager: ${packageManager}`,
                `Dependencies (${dependencies.length}): ${dependencies.join(', ')}`,
                `Planned file changes (${writablePlans.length}):`,
                ...writablePlans.map(item => `- ${item.relativePath} (${item.reason})`),
                ...(skippedConflictPaths.length > 0
                    ? ['Skipped conflicts:', ...skippedConflictPaths.map(item => `- ${item}`)]
                    : []),
            ].join('\n'),
            'Dry run',
        );

        outro('No files were changed.');
        return;
    }

    const dependencySpinner = spinner();
    dependencySpinner.start('Installing Hexos dependencies...');
    await installDependencies({
        cwd: projectInfo.rootDir,
        packageManager,
        dependencies,
    });
    dependencySpinner.stop('Dependencies installed.');

    const writeSpinner = spinner();
    writeSpinner.start('Writing Hexos files...');

    await applyWrites(projectInfo.rootDir, writablePlans);

    const manifest = await buildManifest({
        projectRoot: projectInfo.rootDir,
        hexosVersion,
        installConfig,
        plans,
        skippedConflictPaths,
    });

    await writeManifest(projectInfo.rootDir, manifest, false);

    writeSpinner.stop('Hexos files updated.');

    note(
        [
            `Installed Hexos ${hexosVersion}`,
            `Chat route: /${installConfig.chatRoute}`,
            `Provider: ${installConfig.provider}`,
            `Manifest: .hexos/manifest.json`,
            ...(skippedConflictPaths.length
                ? ['Skipped files:', ...skippedConflictPaths.map(item => `- ${item}`)]
                : []),
            `Docs: ${SUPPORT_MESSAGE}`,
        ].join('\n'),
        'Install complete',
    );

    outro('Done.');
}

async function gatherInstallConfig(input: {
    provider?: LLMProvider;
    apiKey?: string;
    ollamaHost?: string;
    includeMcpDashboard?: boolean;
    includeExampleTools?: boolean;
    agentMode?: 'single' | 'multi';
    chatRoute: string;
    nonInteractive: boolean;
}): Promise<InstallConfig> {
    const provider = await resolveProvider(input.provider, input.nonInteractive);

    const apiKey =
        provider === 'ollama'
            ? ''
            : await resolveApiKey(provider, input.apiKey, input.nonInteractive);

    const ollamaHost =
        provider === 'ollama'
            ? await resolveOllamaHost(input.ollamaHost, input.nonInteractive)
            : DEFAULT_OLLAMA_HOST;

    const includeMcpDashboard =
        input.includeMcpDashboard !== undefined
            ? input.includeMcpDashboard
            : input.nonInteractive
              ? false
              : await resolveConfirm({
                    message: 'Include MCP dashboard API and local server store?',
                    initialValue: false,
                });

    const includeExampleTools =
        input.includeExampleTools !== undefined
            ? input.includeExampleTools
            : input.nonInteractive
              ? true
              : await resolveConfirm({
                    message: 'Include example tools (get_current_time and calculate)?',
                    initialValue: true,
                });

    const agentMode =
        input.agentMode ??
        (input.nonInteractive
            ? 'single'
            : ((await resolveSelect({
                  message: 'Agent setup',
                  options: [
                      {
                          value: 'single',
                          label: 'Single agent',
                      },
                      {
                          value: 'multi',
                          label: 'Multi-agent (orchestrator + specialist)',
                      },
                  ],
              })) as 'single' | 'multi'));

    return {
        provider,
        apiKey,
        ollamaHost,
        includeMcpDashboard,
        includeExampleTools,
        agentMode,
        chatRoute: input.chatRoute,
    };
}

async function resolveProvider(
    value: LLMProvider | undefined,
    nonInteractive: boolean,
): Promise<LLMProvider> {
    if (value) {
        return value;
    }

    if (nonInteractive) {
        return 'anthropic';
    }

    return (await resolveSelect({
        message: 'Choose LLM provider',
        options: [
            { value: 'anthropic', label: 'Anthropic' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'ollama', label: 'Ollama' },
        ],
    })) as LLMProvider;
}

async function resolveApiKey(
    provider: Exclude<LLMProvider, 'ollama'>,
    value: string | undefined,
    nonInteractive: boolean,
): Promise<string> {
    if (value !== undefined) {
        return value;
    }

    if (nonInteractive) {
        return '';
    }

    const providerLabel = provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
    const result = await text({
        message: `${providerLabel} API key (optional, can be added later in .env):`,
        placeholder: 'sk-...',
    });

    if (isCancel(result)) {
        cancel('Cancelled.');
        throw new Error('Cancelled by user.');
    }

    return String(result ?? '');
}

async function resolveOllamaHost(value: string | undefined, nonInteractive: boolean): Promise<string> {
    if (value !== undefined) {
        return value;
    }

    if (nonInteractive) {
        return DEFAULT_OLLAMA_HOST;
    }

    const result = await text({
        message: 'Ollama host URL:',
        initialValue: DEFAULT_OLLAMA_HOST,
    });

    if (isCancel(result)) {
        cancel('Cancelled.');
        throw new Error('Cancelled by user.');
    }

    return String(result ?? DEFAULT_OLLAMA_HOST);
}

async function resolveConfirm(input: { message: string; initialValue: boolean }): Promise<boolean> {
    const result = await confirm(input);
    if (isCancel(result)) {
        cancel('Cancelled.');
        throw new Error('Cancelled by user.');
    }
    return Boolean(result);
}

async function resolveSelect<T extends string>(input: {
    message: string;
    options: Array<{ value: T; label: string }>;
}): Promise<T> {
    const result = await select({
        message: input.message,
        options: input.options as any,
    });

    if (isCancel(result)) {
        cancel('Cancelled.');
        throw new Error('Cancelled by user.');
    }

    return result as T;
}

function buildDependencies(hexosVersion: string, provider: LLMProvider): string[] {
    const base = HEXOS_DEPENDENCIES.map(dependency => `${dependency}@${hexosVersion}`);
    const providerDependencies = OPTIONAL_PROVIDER_DEPENDENCIES[provider];

    return [...base, 'zod@^3.24.0', ...providerDependencies];
}

async function applyWrites(
    projectRoot: string,
    writablePlans: Array<{ relativePath: string; finalContent: string }>,
): Promise<void> {
    for (const plan of writablePlans) {
        const targetPath = path.join(projectRoot, plan.relativePath);
        await fs.ensureDir(path.dirname(targetPath));
        await fs.writeFile(targetPath, plan.finalContent, 'utf8');
    }
}

async function buildManifest(input: {
    projectRoot: string;
    hexosVersion: string;
    installConfig: InstallConfig;
    plans: Array<{ relativePath: string; strategy: 'overwrite' | 'merge-env'; finalContent: string }>;
    skippedConflictPaths: string[];
}): Promise<HexosManifest> {
    const now = new Date().toISOString();
    const skippedSet = new Set(input.skippedConflictPaths);

    const managedFiles: HexosManifest['managedFiles'] = {};

    for (const plan of input.plans) {
        if (skippedSet.has(plan.relativePath)) {
            continue;
        }

        const targetPath = path.join(input.projectRoot, plan.relativePath);
        if (!(await fs.pathExists(targetPath))) {
            continue;
        }

        const content = await fs.readFile(targetPath, 'utf8');
        managedFiles[plan.relativePath] = buildManagedMetadata(content, plan.strategy);
    }

    return {
        schemaVersion: 1,
        installedAt: now,
        updatedAt: now,
        hexosVersion: input.hexosVersion,
        installConfig: input.installConfig,
        managedFiles,
    };
}

function normalizeChatRoute(chatRoute: string): string {
    const normalized = chatRoute
        .trim()
        .replace(/^\/+/, '')
        .replace(/\/+$/, '')
        .replace(/[^A-Za-z0-9/_-]/g, '')
        .replace(/\/+/g, '/');

    return normalized.length > 0 ? normalized : 'chat';
}

function extractProjectName(packageJsonName: string | undefined, projectRoot: string): string {
    if (!packageJsonName) {
        return path.basename(projectRoot);
    }

    const scopeSeparatorIndex = packageJsonName.lastIndexOf('/');
    return scopeSeparatorIndex > -1
        ? packageJsonName.slice(scopeSeparatorIndex + 1)
        : packageJsonName;
}
