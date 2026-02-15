import { cancel, intro, isCancel, select } from '@clack/prompts';
import { Command } from 'commander';
import pc from 'picocolors';

const HEXOS_LOGO = pc.blue(`
██╗  ██╗███████╗██╗  ██╗ ██████╗ ███████╗
██║  ██║██╔════╝╚██╗██╔╝██╔═══██╗██╔════╝
███████║█████╗   ╚███╔╝ ██║   ██║███████╗
██╔══██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
██║  ██║███████╗██╔╝ ██╗╚██████╔╝███████║
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝
`);

interface SelectOption {
    value: string;
    label: string;
    hint?: string;
}

interface SelectInput {
    message: string;
    options: SelectOption[];
}

type SelectPrompt = (input: SelectInput) => Promise<unknown>;

export interface ResolveRootCommandOptions {
    selectPrompt?: SelectPrompt;
    isCancelPrompt?: (value: unknown) => boolean;
    cancelPrompt?: (message?: string) => void;
    stdinIsTTY?: boolean;
    stdoutIsTTY?: boolean;
    ciValue?: string | undefined;
    onNoCommandNonInteractive?: (program: Command) => void;
}

export interface RootCommandResolution {
    argv: string[];
    exitCode?: number;
}

export async function resolveRootCommandInvocation(
    program: Command,
    argv: string[],
    options: ResolveRootCommandOptions = {},
): Promise<RootCommandResolution> {
    const userArgs = argv.slice(2);

    if (userArgs.length > 0) {
        return { argv };
    }

    const interactive = isInteractiveEnvironment({
        stdinIsTTY: options.stdinIsTTY,
        stdoutIsTTY: options.stdoutIsTTY,
        ciValue: options.ciValue,
    });

    if (!interactive) {
        const noCommandHandler = options.onNoCommandNonInteractive ?? defaultNoCommandNonInteractive;
        noCommandHandler(program);
        return { argv, exitCode: 1 };
    }

    const availableCommands = getVisibleCommands(program);
    if (availableCommands.length === 0) {
        defaultNoCommandNonInteractive(program);
        return { argv, exitCode: 1 };
    }

    // eslint-disable-next-line no-console
    console.log(HEXOS_LOGO);
    intro('Welcome to Hexos');

    const selectPrompt = options.selectPrompt ?? select;
    const isCancelPrompt = options.isCancelPrompt ?? isCancel;
    const cancelPrompt = options.cancelPrompt ?? cancel;

    const selectedCommand = await selectPrompt({
        message: 'What would you like to do?',
        options: availableCommands.map(command => ({
            value: command.name(),
            label: command.name(),
            hint: command.description(),
        })),
    });

    if (isCancelPrompt(selectedCommand)) {
        cancelPrompt('Operation cancelled.');
        return { argv, exitCode: 0 };
    }

    return {
        argv: [...argv.slice(0, 2), String(selectedCommand)],
    };
}

function isInteractiveEnvironment(input: {
    stdinIsTTY: boolean | undefined;
    stdoutIsTTY: boolean | undefined;
    ciValue: string | undefined;
}): boolean {
    const stdinIsTTY = input.stdinIsTTY ?? process.stdin.isTTY;
    const stdoutIsTTY = input.stdoutIsTTY ?? process.stdout.isTTY;
    const ciValue = input.ciValue ?? process.env.CI;

    return Boolean(stdinIsTTY && stdoutIsTTY && ciValue !== 'true');
}

function getVisibleCommands(program: Command): Command[] {
    return program.commands.filter(command => command.name() !== 'help' && !isHiddenCommand(command));
}

function isHiddenCommand(command: Command): boolean {
    return Boolean((command as unknown as { _hidden?: boolean })._hidden);
}

function defaultNoCommandNonInteractive(program: Command): void {
    program.outputHelp();
    // eslint-disable-next-line no-console
    console.error(pc.red('No command provided. Run `hexos install` or `hexos upgrade`.'));
}
