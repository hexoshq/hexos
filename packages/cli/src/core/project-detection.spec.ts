import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { assertNextAppRouterProject } from './project-detection';

describe('project-detection', () => {
    const createdDirs: string[] = [];

    afterEach(async () => {
        for (const dir of createdDirs) {
            await fs.remove(dir);
        }
        createdDirs.length = 0;
    });

    it('detects a valid next app router project', async () => {
        const root = await makeProject({ next: true, appDir: true });

        const info = await assertNextAppRouterProject(root);

        expect(info.rootDir).toBe(root);
    });

    it('throws when app directory is missing', async () => {
        const root = await makeProject({ next: true, appDir: false });

        await expect(assertNextAppRouterProject(root)).rejects.toThrow('App Router');
    });

    it('throws when next dependency is missing', async () => {
        const root = await makeProject({ next: false, appDir: true });

        await expect(assertNextAppRouterProject(root)).rejects.toThrow('Next.js');
    });

    async function makeProject(input: { next: boolean; appDir: boolean }): Promise<string> {
        const root = await fs.mkdtemp(path.join(os.tmpdir(), 'hexos-cli-project-detection-'));
        createdDirs.push(root);

        await fs.writeJson(
            path.join(root, 'package.json'),
            {
                name: 'test-project',
                dependencies: input.next ? { next: '15.1.0', react: '19.0.0', 'react-dom': '19.0.0' } : {},
            },
            { spaces: 2 },
        );

        if (input.appDir) {
            await fs.ensureDir(path.join(root, 'app'));
        }

        return root;
    }
});
