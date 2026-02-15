import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'fs';
import { join } from 'path';

import { CliTestProject, createNextTestProject } from './cli-test-utils';

describe('hexos upgrade e2e', () => {
    let project: CliTestProject;

    afterEach(() => {
        if (project) {
            project.cleanup();
        }
    });

    it('upgrades a project with existing manifest', async () => {
        project = createNextTestProject('upgrade-basic');
        await project.runCliCommand(['install', '--yes']);

        const result = await project.runCliCommand(['upgrade', '--yes', '--to', '0.3.2']);
        expect(result.exitCode).toBe(0);

        const manifest = JSON.parse(project.readFile('.hexos/manifest.json')) as {
            hexosVersion: string;
        };
        expect(manifest.hexosVersion).toBe('0.3.2');
    });

    it('fails in non-interactive mode when a managed file changed', async () => {
        project = createNextTestProject('upgrade-conflict');
        await project.runCliCommand(['install', '--yes']);

        project.writeFile('lib/shared-runtime.ts', 'modified by user\n');

        const result = await project.runCliCommand(['upgrade', '--yes'], { expectError: true });
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('Conflicts detected in non-interactive mode');
    });

    it('fails when manifest is missing and --adopt is not set', async () => {
        project = createNextTestProject('upgrade-missing-manifest');

        const result = await project.runCliCommand(['upgrade', '--yes'], { expectError: true });
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('No .hexos/manifest.json found');
    });

    it('adopts current installation when --adopt is provided', async () => {
        project = createNextTestProject('upgrade-adopt');
        await project.runCliCommand(['install', '--yes']);
        rmSync(join(project.projectDir, '.hexos', 'manifest.json'));

        const result = await project.runCliCommand(['upgrade', '--yes', '--adopt']);
        expect(result.exitCode).toBe(0);

        const manifest = JSON.parse(project.readFile('.hexos/manifest.json')) as {
            schemaVersion: number;
        };
        expect(manifest.schemaVersion).toBe(1);
    });
});
