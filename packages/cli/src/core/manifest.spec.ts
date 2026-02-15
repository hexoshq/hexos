import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { getManifestPath, hashContent, readManifest, writeManifest } from './manifest';
import { HexosManifest } from '../types';

describe('manifest', () => {
    const createdDirs: string[] = [];

    afterEach(async () => {
        for (const dir of createdDirs) {
            await fs.remove(dir);
        }
        createdDirs.length = 0;
    });

    it('writes and reads manifest', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hexos-cli-manifest-'));
        createdDirs.push(root);

        const manifest: HexosManifest = {
            schemaVersion: 1,
            installedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
                    sha256: hashContent('hello'),
                    strategy: 'overwrite',
                },
            },
        };

        await writeManifest(root, manifest, false);
        const loaded = await readManifest(root);

        expect(loaded).toEqual(manifest);
        expect(await fs.pathExists(getManifestPath(root))).toBe(true);
    });

    it('returns null when no manifest exists', async () => {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hexos-cli-manifest-empty-'));
        createdDirs.push(root);

        const loaded = await readManifest(root);

        expect(loaded).toBeNull();
    });
});
