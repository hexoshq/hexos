import { intro, note, outro, spinner } from '@clack/prompts';
import { program } from 'commander';
import fs from 'fs-extra';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'path';
import pc from 'picocolors';

import {
    REQUIRED_NODE_VERSION,
    SCAFFOLD_DELAY_MS,
} from './constants';
import {
    gatherUserResponses,
    getCiConfiguration,
} from './gather-user-responses';
import {
    checkNodeVersion,
    checkThatNpmCanReadCwd,
    getHexosDependencies,
    installDependenciesWithSpinner,
    isSafeToCreateProjectIn,
    scaffoldAlreadyExists,
} from './helpers';
import { log, setLogLevel } from './logger';
import type { CliLogLevel, PackageManager } from './types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json');
checkNodeVersion(REQUIRED_NODE_VERSION);

let projectName: string | undefined;

program
    .version(packageJson.version)
    .arguments('<project-directory>')
    .usage(`${pc.green('<project-directory>')} [options]`)
    .action(name => {
        projectName = name;
    })
    .option(
        '--log-level <logLevel>',
        "Log level, either 'silent', 'info', or 'verbose'",
        /^(silent|info|verbose)$/i,
        'info',
    )
    .option('--verbose', 'Alias for --log-level verbose', false)
    .option(
        '--use-npm',
        'Uses npm rather than the default package manager (pnpm).',
    )
    .option('--ci', 'Runs without prompts for use in CI scenarios', false)
    .parse(process.argv);

const options = program.opts();
void createHexosApp(
    projectName,
    options.useNpm,
    options.verbose ? 'verbose' : options.logLevel || 'info',
    options.ci,
).catch(err => {
    log(err);
    process.exit(1);
});

export async function createHexosApp(
    name: string | undefined,
    useNpm: boolean,
    logLevel: CliLogLevel,
    isCi: boolean = false,
) {
    setLogLevel(logLevel);

    if (typeof name === 'undefined') {
        log(
            pc.red(
                '\nPlease specify the project directory:\n' +
                    `  ${pc.cyan('create-hexos-app')} ${pc.green('<project-directory>')}\n\n` +
                    'For example:\n' +
                    `  ${pc.cyan('create-hexos-app')} ${pc.green('my-hexos-app')}\n`,
            ),
        );
        process.exit(1);
    }

    const root = path.resolve(name);
    const packageManager: PackageManager = useNpm ? 'npm' : 'pnpm';

    if (packageManager === 'npm' && !checkThatNpmCanReadCwd()) {
        process.exit(1);
    }

    intro(
        `Let's create a ${pc.blue(pc.bold('Hexos App'))} ${pc.dim(`v${packageJson.version as string}`)}`,
    );

    // Check if the directory already exists and is safe
    await fs.ensureDir(root);
    if (!isSafeToCreateProjectIn(root, name)) {
        process.exit(1);
    }
    if (scaffoldAlreadyExists(root)) {
        log(
            pc.yellow(
                `It looks like a project already exists in ${pc.green(root)}. ` +
                    'Please use a new directory.',
            ),
        );
        process.exit(1);
    }

    // 1. Gather user input
    const userResponses = isCi
        ? await getCiConfiguration(root, packageManager)
        : await gatherUserResponses(root, packageManager);

    // 2. Scaffold project files
    const scaffoldSpinner = spinner();
    scaffoldSpinner.start(`Scaffolding project in ${pc.green(root)}...`);
    await sleep(SCAFFOLD_DELAY_MS);

    try {
        // Create directory structure
        await fs.ensureDir(path.join(root, 'app', 'api', 'agent', 'chat', 'approve'));
        await fs.ensureDir(path.join(root, 'app', 'api', 'mcp'));
        await fs.ensureDir(path.join(root, 'lib'));
        await fs.ensureDir(path.join(root, 'public'));

        const assetPath = (fileName: string) => path.join(__dirname, '../assets', fileName);

        // Dynamic (templated) files
        await fs.writeFile(path.join(root, 'package.json'), userResponses.packageJsonSource);
        await fs.writeFile(path.join(root, '.env'), userResponses.envSource);
        await fs.writeFile(path.join(root, '.env.example'), userResponses.envExampleSource);
        await fs.writeFile(path.join(root, 'app', 'layout.tsx'), userResponses.layoutSource);
        await fs.writeFile(path.join(root, 'lib', 'shared-runtime.ts'), userResponses.sharedRuntimeSource);
        await fs.writeFile(path.join(root, 'app', 'page.tsx'), userResponses.pageSource);

        // Static (verbatim copy) files
        await fs.copyFile(assetPath('static/next.config.js'), path.join(root, 'next.config.js'));
        await fs.copyFile(assetPath('static/tsconfig.json'), path.join(root, 'tsconfig.json'));
        await fs.copyFile(
            assetPath('static/gitignore.template'),
            path.join(root, '.gitignore'),
        );
        await fs.copyFile(assetPath('static/globals.css'), path.join(root, 'app', 'globals.css'));
        await fs.copyFile(
            assetPath('static/chat-route.ts'),
            path.join(root, 'app', 'api', 'agent', 'chat', 'route.ts'),
        );
        await fs.copyFile(
            assetPath('static/approve-route.ts'),
            path.join(root, 'app', 'api', 'agent', 'chat', 'approve', 'route.ts'),
        );

        // MCP files (always copy — needed even without dashboard for basic MCP support)
        if (userResponses.includeMcpDashboard) {
            await fs.copyFile(
                assetPath('static/mcp-route.ts'),
                path.join(root, 'app', 'api', 'mcp', 'route.ts'),
            );
            await fs.copyFile(
                assetPath('static/mcp-server-store.ts'),
                path.join(root, 'lib', 'mcp-server-store.ts'),
            );
        }

        // Create empty .mcp-servers.local.json
        await fs.writeFile(path.join(root, '.mcp-servers.local.json'), '{}\n');

        scaffoldSpinner.stop('Project scaffolded');
    } catch (e: any) {
        scaffoldSpinner.stop(pc.red('Failed to scaffold project'));
        log(pc.red(e.message || e.toString()));
        process.exit(1);
    }

    // 3. Install dependencies
    const { dependencies, devDependencies } = getHexosDependencies(userResponses.llmProvider);

    try {
        await installDependenciesWithSpinner({
            dependencies,
            packageManager,
            logLevel,
            cwd: root,
            spinnerMessage: 'Installing dependencies...',
            successMessage: 'Dependencies installed',
            failureMessage: 'Failed to install dependencies.',
        });

        if (devDependencies.length > 0) {
            await installDependenciesWithSpinner({
                dependencies: devDependencies,
                isDevDependencies: true,
                packageManager,
                logLevel,
                cwd: root,
                spinnerMessage: 'Installing dev dependencies...',
                successMessage: 'Dev dependencies installed',
                failureMessage: 'Failed to install dev dependencies.',
            });
        }
    } catch {
        log(
            pc.yellow(
                '\nDependency installation failed. You can install them manually by running:\n' +
                    `  cd ${name}\n  ${packageManager} install\n`,
            ),
        );
    }

    // 4. Display outro
    const runCmd = packageManager === 'npm' ? 'npm run dev' : 'pnpm dev';
    const nextSteps = [
        `Your new Hexos app is ready!`,
        pc.dim(root),
        '',
        'Next steps:',
        pc.dim('$ ') + pc.blue(pc.bold(`cd ${name}`)),
        ...(userResponses.apiKey
            ? []
            : [pc.dim('$ ') + pc.yellow('# Add your API key to .env')]),
        pc.dim('$ ') + pc.blue(pc.bold(runCmd)),
        '',
        `Then open ${pc.green('http://localhost:3000')} in your browser.`,
        '',
        `Docs: ${pc.cyan('https://hexos.dev/docs')}`,
    ];

    note(nextSteps.join('\n'), pc.green('Setup complete!'));
    outro('Happy building!');
    process.exit(0);
}
