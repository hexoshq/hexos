#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';

import { registerHexosCommands } from './commands/command-declarations';
import { resolveRootCommandInvocation } from './root-command';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json') as { version: string };

export function createProgram(): Command {
    const program = new Command();

    program
        .name('hexos')
        .version(packageJson.version)
        .usage('<command> [options]')
        .description(
            pc.blue(`
██╗  ██╗███████╗██╗  ██╗ ██████╗ ███████╗
██║  ██║██╔════╝╚██╗██╔╝██╔═══██╗██╔════╝
███████║█████╗   ╚███╔╝ ██║   ██║███████╗
██╔══██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║  ██║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
`),
        )
        .showHelpAfterError();

    registerHexosCommands(program);

    return program;
}

export async function runCli(argv: string[] = process.argv): Promise<number> {
    const program = createProgram();
    const resolution = await resolveRootCommandInvocation(program, argv);

    if (resolution.exitCode !== undefined) {
        return resolution.exitCode;
    }

    await program.parseAsync(resolution.argv);
    return 0;
}

void runCli().then(
    exitCode => {
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    },
    error => {
        // eslint-disable-next-line no-console
        console.error(pc.red(error?.message ?? String(error)));
        process.exit(1);
    },
);
