#!/usr/bin/env node

import { Command } from 'commander';
import pc from 'picocolors';

import { registerHexosCommands } from './commands/command-declarations';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json') as { version: string };

const program = new Command();

program
    .name('hexos')
    .version(packageJson.version)
    .usage('hexos <command> [options]')
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

void program.parseAsync(process.argv).catch(error => {
    // eslint-disable-next-line no-console
    console.error(pc.red(error?.message ?? String(error)));
    process.exit(1);
});
