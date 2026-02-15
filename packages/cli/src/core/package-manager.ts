import spawn from 'cross-spawn';
import fs from 'fs-extra';
import path from 'path';

import { SupportedPackageManager } from '../types';

export function detectPackageManager(
    projectRoot: string,
    override?: SupportedPackageManager,
): SupportedPackageManager {
    if (override) {
        return override;
    }

    if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
        return 'pnpm';
    }
    if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
        return 'yarn';
    }
    if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
        return 'npm';
    }

    return 'npm';
}

export async function installDependencies(options: {
    cwd: string;
    packageManager: SupportedPackageManager;
    dependencies: string[];
    dryRun?: boolean;
}): Promise<string> {
    const { cwd, packageManager, dependencies, dryRun = false } = options;

    if (dependencies.length === 0) {
        return `${packageManager} install`;
    }

    const commandSpec = buildInstallCommand(packageManager, dependencies);

    if (dryRun || process.env.HEXOS_CLI_SKIP_INSTALL === '1') {
        return `${commandSpec.command} ${commandSpec.args.join(' ')}`;
    }

    await spawnCommand(commandSpec.command, commandSpec.args, cwd);

    return `${commandSpec.command} ${commandSpec.args.join(' ')}`;
}

function buildInstallCommand(
    packageManager: SupportedPackageManager,
    dependencies: string[],
): { command: string; args: string[] } {
    if (packageManager === 'pnpm') {
        return {
            command: 'pnpm',
            args: ['add', '--save-exact', ...dependencies],
        };
    }

    if (packageManager === 'yarn') {
        return {
            command: 'yarn',
            args: ['add', '--exact', ...dependencies],
        };
    }

    return {
        command: 'npm',
        args: ['install', '--save-exact', ...dependencies],
    };
}

function spawnCommand(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            stdio: 'inherit',
            env: process.env,
        });

        child.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Dependency installation failed: ${command} ${args.join(' ')}`));
            }
        });

        child.on('error', error => {
            reject(error);
        });
    });
}
