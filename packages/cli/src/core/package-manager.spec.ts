import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { detectPackageManager, installDependencies } from './package-manager';

describe('package-manager', () => {
    const createdDirs: string[] = [];

    afterEach(async () => {
        for (const dir of createdDirs) {
            await fs.remove(dir);
        }
        createdDirs.length = 0;
    });

    it('detects pnpm by lockfile', async () => {
        const root = await makeDir();
        await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n');

        expect(detectPackageManager(root)).toBe('pnpm');
    });

    it('detects yarn by lockfile', async () => {
        const root = await makeDir();
        await fs.writeFile(path.join(root, 'yarn.lock'), 'test\n');

        expect(detectPackageManager(root)).toBe('yarn');
    });

    it('falls back to npm when no lockfile is found', async () => {
        const root = await makeDir();

        expect(detectPackageManager(root)).toBe('npm');
    });

    it('returns dry-run command without executing installation', async () => {
        const root = await makeDir();

        const command = await installDependencies({
            cwd: root,
            packageManager: 'pnpm',
            dependencies: ['@hexos/runtime@0.3.2'],
            dryRun: true,
        });

        expect(command).toContain('pnpm add --save-exact @hexos/runtime@0.3.2');
    });

    async function makeDir(): Promise<string> {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hexos-cli-package-manager-'));
        createdDirs.push(root);
        return root;
    }
});
