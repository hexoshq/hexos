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

    it('backfills route style files for legacy manifests during upgrade', async () => {
        project = createNextTestProject('upgrade-style-backfill');
        await project.runCliCommand(['install', '--yes', '--mcp-dashboard']);

        const manifest = JSON.parse(project.readFile('.hexos/manifest.json')) as {
            managedFiles: Record<string, unknown>;
        };
        delete manifest.managedFiles['app/chat/layout.tsx'];
        delete manifest.managedFiles['app/chat/hexos.css'];
        project.writeFile('.hexos/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

        rmSync(join(project.projectDir, 'app', 'chat', 'layout.tsx'));
        rmSync(join(project.projectDir, 'app', 'chat', 'hexos.css'));

        const result = await project.runCliCommand(['upgrade', '--yes']);
        expect(result.exitCode).toBe(0);
        expect(project.fileExists('app/chat/layout.tsx')).toBe(true);
        expect(project.readFile('app/chat/layout.tsx')).toContain("./hexos.css");
        expect(project.fileExists('app/chat/hexos.css')).toBe(true);
        expect(project.readFile('app/chat/hexos.css')).toContain('.mcp-page');

        const updatedManifest = JSON.parse(project.readFile('.hexos/manifest.json')) as {
            managedFiles: Record<string, unknown>;
        };
        expect(updatedManifest.managedFiles['app/chat/layout.tsx']).toBeDefined();
        expect(updatedManifest.managedFiles['app/chat/hexos.css']).toBeDefined();
    });

    it('fails in non-interactive mode when a managed file changed', async () => {
        project = createNextTestProject('upgrade-conflict');
        await project.runCliCommand(['install', '--yes']);

        project.writeFile('lib/shared-runtime.ts', 'modified by user\n');

        const result = await project.runCliCommand(['upgrade', '--yes'], { expectError: true });
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('Conflicts detected in non-interactive mode');
    });

    it('fails in non-interactive mode when an untracked style file diverged', async () => {
        project = createNextTestProject('upgrade-style-conflict');
        await project.runCliCommand(['install', '--yes']);

        const manifest = JSON.parse(project.readFile('.hexos/manifest.json')) as {
            managedFiles: Record<string, unknown>;
        };
        delete manifest.managedFiles['app/chat/layout.tsx'];
        project.writeFile('.hexos/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
        project.writeFile(
            'app/chat/layout.tsx',
            `export default function CustomLayout({ children }: { children: React.ReactNode }) {\n  return <div>{children}</div>;\n}\n`,
        );

        const result = await project.runCliCommand(['upgrade', '--yes'], { expectError: true });
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('Conflicts detected in non-interactive mode');
        expect(result.stderr).toContain('app/chat/layout.tsx');
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
