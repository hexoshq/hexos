import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';

import { resolveRootCommandInvocation } from './root-command';

function createProgram(): Command {
    const program = new Command();

    program.command('install').description('Install Hexos in an existing project');
    program.command('upgrade').description('Upgrade Hexos in an existing project');
    const hidden = program.command('hidden').description('Hidden command');
    (hidden as unknown as { _hidden: boolean })._hidden = true;

    return program;
}

describe('root-command', () => {
    it('opens interactive menu in TTY mode and derives options from visible commands', async () => {
        const program = createProgram();
        const selectPrompt = vi.fn().mockResolvedValue('install');

        const resolution = await resolveRootCommandInvocation(program, ['node', 'cli.js'], {
            selectPrompt,
            stdinIsTTY: true,
            stdoutIsTTY: true,
            ciValue: undefined,
        });

        expect(selectPrompt).toHaveBeenCalledOnce();
        expect(selectPrompt).toHaveBeenCalledWith({
            message: 'What would you like to do?',
            options: [
                {
                    value: 'install',
                    label: 'install',
                    hint: 'Install Hexos in an existing project',
                },
                {
                    value: 'upgrade',
                    label: 'upgrade',
                    hint: 'Upgrade Hexos in an existing project',
                },
            ],
        });
        expect(resolution.exitCode).toBeUndefined();
        expect(resolution.argv).toEqual(['node', 'cli.js', 'install']);
    });

    it('does not open interactive menu when help or version flags are provided', async () => {
        const program = createProgram();
        const selectPrompt = vi.fn();

        const helpResolution = await resolveRootCommandInvocation(program, ['node', 'cli.js', '--help'], {
            selectPrompt,
            stdinIsTTY: true,
            stdoutIsTTY: true,
        });
        const versionResolution = await resolveRootCommandInvocation(
            program,
            ['node', 'cli.js', '--version'],
            {
                selectPrompt,
                stdinIsTTY: true,
                stdoutIsTTY: true,
            },
        );

        expect(selectPrompt).not.toHaveBeenCalled();
        expect(helpResolution.argv).toEqual(['node', 'cli.js', '--help']);
        expect(versionResolution.argv).toEqual(['node', 'cli.js', '--version']);
    });

    it('does not open interactive menu when an explicit subcommand is provided', async () => {
        const program = createProgram();
        const selectPrompt = vi.fn();

        const resolution = await resolveRootCommandInvocation(program, ['node', 'cli.js', 'upgrade'], {
            selectPrompt,
            stdinIsTTY: true,
            stdoutIsTTY: true,
        });

        expect(selectPrompt).not.toHaveBeenCalled();
        expect(resolution.argv).toEqual(['node', 'cli.js', 'upgrade']);
    });

    it('returns cleanly when the interactive prompt is cancelled', async () => {
        const program = createProgram();
        const cancelledValue = Symbol('cancelled');
        const cancelPrompt = vi.fn();

        const resolution = await resolveRootCommandInvocation(program, ['node', 'cli.js'], {
            selectPrompt: vi.fn().mockResolvedValue(cancelledValue),
            isCancelPrompt: value => value === cancelledValue,
            cancelPrompt,
            stdinIsTTY: true,
            stdoutIsTTY: true,
        });

        expect(cancelPrompt).toHaveBeenCalledWith('Operation cancelled.');
        expect(resolution.exitCode).toBe(0);
        expect(resolution.argv).toEqual(['node', 'cli.js']);
    });

    it('shows non-interactive handler and exits with code 1 when no command is provided', async () => {
        const program = createProgram();
        const onNoCommandNonInteractive = vi.fn();
        const selectPrompt = vi.fn();

        const resolution = await resolveRootCommandInvocation(program, ['node', 'cli.js'], {
            selectPrompt,
            stdinIsTTY: false,
            stdoutIsTTY: false,
            onNoCommandNonInteractive,
        });

        expect(selectPrompt).not.toHaveBeenCalled();
        expect(onNoCommandNonInteractive).toHaveBeenCalledWith(program);
        expect(resolution.exitCode).toBe(1);
        expect(resolution.argv).toEqual(['node', 'cli.js']);
    });
});
