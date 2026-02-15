import { afterEach, describe, expect, it } from 'vitest';

import { CliTestProject, createNextTestProject } from './cli-test-utils';

describe('hexos install e2e', () => {
    let project: CliTestProject;

    afterEach(() => {
        if (project) {
            project.cleanup();
        }
    });

    it('installs in existing Next app and creates /app/chat/page.tsx without replacing app/page.tsx', async () => {
        project = createNextTestProject('install-basic');

        const result = await project.runCliCommand(['install', '--yes']);
        expect(result.exitCode).toBe(0);

        expect(project.fileExists('app/chat/page.tsx')).toBe(true);
        expect(project.fileExists('app/page.tsx')).toBe(true);
        expect(project.readFile('app/page.tsx')).toContain('Home');

        expect(project.fileExists('app/api/agent/chat/route.ts')).toBe(true);
        expect(project.fileExists('app/api/agent/chat/approve/route.ts')).toBe(true);
        expect(project.fileExists('lib/shared-runtime.ts')).toBe(true);
        expect(project.fileExists('.hexos/manifest.json')).toBe(true);
    });

    it('generates MCP files when --mcp-dashboard is enabled', async () => {
        project = createNextTestProject('install-mcp');

        const result = await project.runCliCommand(['install', '--yes', '--mcp-dashboard']);
        expect(result.exitCode).toBe(0);

        expect(project.fileExists('app/api/mcp/route.ts')).toBe(true);
        expect(project.fileExists('lib/mcp-server-store.ts')).toBe(true);
        expect(project.fileExists('.mcp-servers.local.json')).toBe(true);
    });

    it('fails in non-interactive mode when conflicts exist', async () => {
        project = createNextTestProject('install-conflict');
        project.writeFile('lib/shared-runtime.ts', 'custom content\n');

        const result = await project.runCliCommand(['install', '--yes'], { expectError: true });
        expect(result.exitCode).not.toBe(0);
        expect(result.stderr).toContain('Conflicts detected in non-interactive mode');
    });

    it('supports dry-run without mutating the project', async () => {
        project = createNextTestProject('install-dry-run');

        const result = await project.runCliCommand(['install', '--yes', '--dry-run']);
        expect(result.exitCode).toBe(0);

        expect(project.fileExists('app/chat/page.tsx')).toBe(false);
        expect(project.fileExists('.hexos/manifest.json')).toBe(false);
        expect(result.stdout).toContain('Dry run');
    });
});
