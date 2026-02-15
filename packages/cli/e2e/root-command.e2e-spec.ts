import { afterEach, describe, expect, it } from 'vitest';

import { CliTestProject, createNextTestProject } from './cli-test-utils';

describe('hexos root command e2e', () => {
    let project: CliTestProject;

    afterEach(() => {
        if (project) {
            project.cleanup();
        }
    });

    it('exits with error and shows help when invoked without a subcommand in non-interactive mode', async () => {
        project = createNextTestProject('root-no-command');

        const result = await project.runCliCommand([], { expectError: true });

        expect(result.exitCode).not.toBe(0);
        expect(result.stdout).toContain('Usage:');
        expect(result.stderr).toContain('No command provided');
    });
});
