import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { buildFileActionPlan, resolveConflicts } from './conflict-resolution';
import { hashContent } from './manifest';
import { HexosManifest, PlannedFile } from '../types';

describe('conflict-resolution', () => {
    const createdDirs: string[] = [];

    afterEach(async () => {
        for (const dir of createdDirs) {
            await fs.remove(dir);
        }
        createdDirs.length = 0;
    });

    it('marks overwrite conflicts during install when file already exists', async () => {
        const root = await makeProjectDir();
        await writeFile(root, 'lib/shared-runtime.ts', 'existing\n');

        const plans = await buildFileActionPlan({
            projectRoot: root,
            plannedFiles: [
                {
                    relativePath: 'lib/shared-runtime.ts',
                    content: 'new\n',
                    strategy: 'overwrite',
                },
            ],
            mode: 'install',
            manifest: null,
        });

        expect(plans[0].conflict).toBe(true);
    });

    it('marks upgrade conflict when tracked file hash changed', async () => {
        const root = await makeProjectDir();
        await writeFile(root, 'lib/shared-runtime.ts', 'user-modified\n');

        const manifest: HexosManifest = {
            schemaVersion: 1,
            installedAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
            hexosVersion: '0.3.2',
            installConfig: {
                provider: 'openai',
                apiKey: '',
                ollamaHost: 'http://localhost:11434',
                includeMcpDashboard: false,
                includeExampleTools: true,
                agentMode: 'single',
                chatRoute: 'chat',
            },
            managedFiles: {
                'lib/shared-runtime.ts': {
                    sha256: hashContent('original\n'),
                    strategy: 'overwrite',
                },
            },
        };

        const plans = await buildFileActionPlan({
            projectRoot: root,
            plannedFiles: [
                {
                    relativePath: 'lib/shared-runtime.ts',
                    content: 'updated\n',
                    strategy: 'overwrite',
                },
            ],
            mode: 'upgrade',
            manifest,
        });

        expect(plans[0].conflict).toBe(true);
    });

    it('does not conflict for merge-env strategy', async () => {
        const root = await makeProjectDir();
        await writeFile(root, '.env', 'OPENAI_API_KEY=abc\n');

        const plans = await buildFileActionPlan({
            projectRoot: root,
            plannedFiles: [
                {
                    relativePath: '.env',
                    content: 'ANTHROPIC_API_KEY=def\n',
                    strategy: 'merge-env',
                },
            ],
            mode: 'install',
            manifest: null,
        });

        expect(plans[0].conflict).toBe(false);
        expect(plans[0].finalContent).toContain('OPENAI_API_KEY=abc');
        expect(plans[0].finalContent).toContain('ANTHROPIC_API_KEY=def');
    });

    it('fails in non-interactive mode when conflicts exist', async () => {
        await expect(
            resolveConflicts({
                plans: [
                    {
                        relativePath: 'a.txt',
                        strategy: 'overwrite',
                        desiredContent: 'x',
                        finalContent: 'x',
                        changed: true,
                        reason: 'update',
                        conflict: true,
                        conflictMessage: 'changed',
                    },
                ],
                nonInteractive: true,
            }),
        ).rejects.toThrow('Conflicts detected in non-interactive mode');
    });

    async function makeProjectDir(): Promise<string> {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hexos-cli-conflicts-'));
        createdDirs.push(root);
        return root;
    }

    async function writeFile(projectRoot: string, relativePath: string, content: string): Promise<void> {
        const fullPath = path.join(projectRoot, relativePath);
        await fs.ensureDir(path.dirname(fullPath));
        await fs.writeFile(fullPath, content, 'utf8');
    }
});
