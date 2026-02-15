import { Command, Option } from 'commander';

import { installCommand } from './install/install';
import { upgradeCommand } from './upgrade/upgrade';

export function registerHexosCommands(program: Command): void {
    const install = program
        .command('install [projectPath]')
        .description('Install and configure Hexos in an existing Next.js App Router project')
        .addOption(
            new Option('--provider <anthropic|openai|ollama>', 'LLM provider to configure').choices([
                'anthropic',
                'openai',
                'ollama',
            ]),
        )
        .option('--api-key <key>', 'API key for the selected provider')
        .option('--ollama-host <url>', 'Ollama host URL (used with provider=ollama)')
        .addOption(
            new Option(
                '--mcp-dashboard',
                'Generate MCP dashboard endpoints and local server store files',
            ).default(undefined),
        )
        .addOption(new Option('--no-mcp-dashboard', 'Disable MCP dashboard generation').default(undefined))
        .addOption(
            new Option('--example-tools', 'Include example tools in shared runtime').default(undefined),
        )
        .addOption(new Option('--no-example-tools', 'Do not include example tools').default(undefined))
        .addOption(
            new Option('--agents <single|multi>', 'Agent setup mode').choices(['single', 'multi']),
        )
        .option('--chat-route <segment>', 'Route segment for generated chat page (default: chat)')
        .option('--yes', 'Run non-interactively using defaults when options are omitted')
        .option('--force', 'Overwrite conflicting files without prompting')
        .option('--dry-run', 'Show planned changes without writing files')
        .addOption(
            new Option('--package-manager <pnpm|npm|yarn>', 'Package manager override').choices([
                'pnpm',
                'npm',
                'yarn',
            ]),
        )
        .action(async (projectPath, options) => {
            await installCommand(projectPath, options);
        });

    const upgrade = program
        .command('upgrade [projectPath]')
        .description('Upgrade Hexos dependencies and managed files in an existing project')
        .option('--to <version>', 'Target Hexos version (default: current CLI-managed version)')
        .option('--yes', 'Run non-interactively (fails on conflicts)')
        .option('--force', 'Overwrite conflicting files without prompting')
        .option('--dry-run', 'Show planned changes without writing files')
        .addOption(
            new Option('--package-manager <pnpm|npm|yarn>', 'Package manager override').choices([
                'pnpm',
                'npm',
                'yarn',
            ]),
        )
        .option('--adopt', 'Create a manifest from existing Hexos files if one does not exist')
        .action(async (projectPath, options) => {
            await upgradeCommand(projectPath, options);
        });

    install.configureHelp({ sortSubcommands: true, sortOptions: true });
    upgrade.configureHelp({ sortOptions: true });
}
