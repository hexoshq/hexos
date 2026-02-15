import { intro, note, outro, spinner } from '@clack/prompts';
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
import { HEXOS_DEPENDENCIES, OPTIONAL_PROVIDER_DEPENDENCIES, SUPPORT_MESSAGE } from '../../constants';
import { HexosManifest, InstallConfig, LLMProvider, SupportedPackageManager } from '../../types';

export interface UpgradeCommandOptions {
    to?: string;
    yes?: boolean;
    force?: boolean;
    dryRun?: boolean;
    packageManager?: SupportedPackageManager;
    adopt?: boolean;
}

export async function upgradeCommand(projectPath: string | undefined, options: UpgradeCommandOptions) {
    assertNodeVersion();

    const projectInfo = await assertNextAppRouterProject(projectPath);
    const nonInteractive = Boolean(options.yes || process.env.CI === 'true');

    intro(`Hexos upgrade in ${projectInfo.rootDir}`);

    let manifest = await readManifest(projectInfo.rootDir);

    if (!manifest) {
        if (!options.adopt) {
            throw new Error(
                'No .hexos/manifest.json found. Run `hexos upgrade --adopt` once to adopt current files.',
            );
        }
        manifest = await adoptExistingInstallation(projectInfo.rootDir, projectInfo.packageJson.name);
        if (!options.dryRun) {
            await writeManifest(projectInfo.rootDir, manifest, false);
        }
    }

    const targetVersion = options.to ?? getDefaultHexosVersion();
    const packageManager = detectPackageManager(projectInfo.rootDir, options.packageManager);

    const generatedFiles = await generateInstallFiles({
        projectName: extractProjectName(projectInfo.packageJson.name, projectInfo.rootDir),
        installConfig: manifest.installConfig,
        appDescription: projectInfo.packageJson.description,
    });

    const generatedByPath = new Map(generatedFiles.map(file => [file.relativePath, file]));
    const managedPaths = Object.keys(manifest.managedFiles);
    const plannedPaths = Array.from(new Set([...managedPaths, ...generatedByPath.keys()]));
    const plannedFiles = plannedPaths
        .map(managedPath => generatedByPath.get(managedPath))
        .filter((file): file is NonNullable<typeof file> => Boolean(file));
    const effectiveManifest = await buildEffectiveManifestForUpgrade(
        projectInfo.rootDir,
        manifest,
        generatedByPath,
    );

    const plans = await buildFileActionPlan({
        projectRoot: projectInfo.rootDir,
        plannedFiles,
        mode: 'upgrade',
        manifest: effectiveManifest,
        force: options.force,
    });

    const resolution = await resolveConflicts({
        plans,
        nonInteractive,
        force: options.force,
    });

    const writablePlans = getWritablePlans(plans, resolution);
    const skippedConflictPaths = getSkippedConflictPaths(plans, resolution);

    const dependencies = buildDependencies(targetVersion, manifest.installConfig.provider);

    if (options.dryRun) {
        note(
            [
                `Target version: ${targetVersion}`,
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
    dependencySpinner.start('Updating Hexos dependencies...');
    await installDependencies({
        cwd: projectInfo.rootDir,
        packageManager,
        dependencies,
    });
    dependencySpinner.stop('Dependencies updated.');

    const writeSpinner = spinner();
    writeSpinner.start('Applying managed file updates...');
    await applyWrites(projectInfo.rootDir, writablePlans);

    const updatedManifest = await rebuildManifest({
        projectRoot: projectInfo.rootDir,
        previousManifest: manifest,
        generatedByPath,
        targetVersion,
    });

    await writeManifest(projectInfo.rootDir, updatedManifest, false);
    writeSpinner.stop('Managed files upgraded.');

    note(
        [
            `Upgraded to Hexos ${targetVersion}`,
            `Managed files tracked: ${Object.keys(updatedManifest.managedFiles).length}`,
            ...(skippedConflictPaths.length
                ? ['Skipped files:', ...skippedConflictPaths.map(item => `- ${item}`)]
                : []),
            `Docs: ${SUPPORT_MESSAGE}`,
        ].join('\n'),
        'Upgrade complete',
    );

    outro('Done.');
}

async function adoptExistingInstallation(
    projectRoot: string,
    packageName: string | undefined,
): Promise<HexosManifest> {
    const inferredConfig = await inferInstallConfig(projectRoot);
    const generatedFiles = await generateInstallFiles({
        projectName: extractProjectName(packageName, projectRoot),
        installConfig: inferredConfig,
        appDescription: 'AI chat powered by Hexos',
    });

    const managedFiles: HexosManifest['managedFiles'] = {};

    for (const file of generatedFiles) {
        const targetPath = path.join(projectRoot, file.relativePath);
        if (!(await fs.pathExists(targetPath))) {
            continue;
        }
        const content = await fs.readFile(targetPath, 'utf8');
        managedFiles[file.relativePath] = buildManagedMetadata(content, file.strategy);
    }

    if (Object.keys(managedFiles).length === 0) {
        throw new Error(
            'No existing Hexos-managed files were found to adopt. Run `hexos install` first.',
        );
    }

    const now = new Date().toISOString();

    return {
        schemaVersion: 1,
        installedAt: now,
        updatedAt: now,
        hexosVersion: getDefaultHexosVersion(),
        installConfig: inferredConfig,
        managedFiles,
    };
}

async function inferInstallConfig(projectRoot: string): Promise<InstallConfig> {
    const envPath = path.join(projectRoot, '.env');
    const envContent = (await fs.pathExists(envPath)) ? await fs.readFile(envPath, 'utf8') : '';

    const hasOpenAI = /(^|\n)\s*OPENAI_API_KEY\s*=/.test(envContent);
    const hasAnthropic = /(^|\n)\s*ANTHROPIC_API_KEY\s*=/.test(envContent);
    const ollamaHostMatch = envContent.match(/(^|\n)\s*OLLAMA_HOST\s*=\s*([^\n]+)/);

    const includeMcpDashboard =
        (await fs.pathExists(path.join(projectRoot, 'app/api/mcp/route.ts'))) ||
        (await fs.pathExists(path.join(projectRoot, 'lib/mcp-server-store.ts')));

    const sharedRuntimePath = path.join(projectRoot, 'lib/shared-runtime.ts');
    const sharedRuntimeContent = (await fs.pathExists(sharedRuntimePath))
        ? await fs.readFile(sharedRuntimePath, 'utf8')
        : '';

    const agentMode = /specialist/.test(sharedRuntimeContent) ? 'multi' : 'single';
    const includeExampleTools = /get_current_time/.test(sharedRuntimeContent);

    const provider: LLMProvider = hasOpenAI ? 'openai' : hasAnthropic ? 'anthropic' : 'ollama';
    const ollamaHost = ollamaHostMatch?.[2]?.trim() ?? 'http://localhost:11434';

    return {
        provider,
        apiKey: '',
        ollamaHost,
        includeMcpDashboard,
        includeExampleTools,
        agentMode,
        chatRoute: await detectChatRoute(projectRoot),
    };
}

async function detectChatRoute(projectRoot: string): Promise<string> {
    const appDir = path.join(projectRoot, 'app');
    const defaultRoute = 'chat';
    const defaultPagePath = path.join(appDir, defaultRoute, 'page.tsx');

    if (await fs.pathExists(defaultPagePath)) {
        return defaultRoute;
    }

    if (!(await fs.pathExists(appDir))) {
        return defaultRoute;
    }

    const entries = await fs.readdir(appDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('(')) {
            continue;
        }
        const pagePath = path.join(appDir, entry.name, 'page.tsx');
        if (!(await fs.pathExists(pagePath))) {
            continue;
        }
        const content = await fs.readFile(pagePath, 'utf8');
        if (content.includes('@hexos/react-ui') || content.includes('ChatWindow')) {
            return entry.name;
        }
    }

    return defaultRoute;
}

function buildDependencies(hexosVersion: string, provider: LLMProvider): string[] {
    const base = HEXOS_DEPENDENCIES.map(dependency => `${dependency}@${hexosVersion}`);
    return [...base, 'zod@^3.24.0', ...OPTIONAL_PROVIDER_DEPENDENCIES[provider]];
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

async function rebuildManifest(input: {
    projectRoot: string;
    previousManifest: HexosManifest;
    generatedByPath: Map<string, { strategy: 'overwrite' | 'merge-env' }>;
    targetVersion: string;
}): Promise<HexosManifest> {
    const managedFiles: HexosManifest['managedFiles'] = {};

    const allManagedPaths = new Set([
        ...Object.keys(input.previousManifest.managedFiles),
        ...input.generatedByPath.keys(),
    ]);

    for (const relativePath of allManagedPaths) {
        const previousMetadata = input.previousManifest.managedFiles[relativePath];
        const strategy =
            input.generatedByPath.get(relativePath)?.strategy ?? previousMetadata?.strategy ?? 'overwrite';
        const targetPath = path.join(input.projectRoot, relativePath);
        if (!(await fs.pathExists(targetPath))) {
            continue;
        }

        const content = await fs.readFile(targetPath, 'utf8');
        managedFiles[relativePath] = buildManagedMetadata(content, strategy);
    }

    return {
        ...input.previousManifest,
        updatedAt: new Date().toISOString(),
        hexosVersion: input.targetVersion,
        managedFiles,
    };
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

async function buildEffectiveManifestForUpgrade(
    projectRoot: string,
    manifest: HexosManifest,
    generatedByPath: Map<string, { content: string; strategy: 'overwrite' | 'merge-env' }>,
): Promise<HexosManifest> {
    const managedFiles = { ...manifest.managedFiles };

    for (const [relativePath, generatedFile] of generatedByPath.entries()) {
        if (managedFiles[relativePath]) {
            continue;
        }

        const targetPath = path.join(projectRoot, relativePath);
        if (!(await fs.pathExists(targetPath))) {
            continue;
        }

        const existingContent = await fs.readFile(targetPath, 'utf8');
        if (existingContent === generatedFile.content) {
            managedFiles[relativePath] = buildManagedMetadata(existingContent, generatedFile.strategy);
        }
    }

    return {
        ...manifest,
        managedFiles,
    };
}
