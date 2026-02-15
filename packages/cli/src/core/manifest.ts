import { createHash } from 'crypto';
import fs from 'fs-extra';
import path from 'path';

import { HexosManifest, ManagedFileMetadata } from '../types';

export function getManifestPath(projectRoot: string): string {
    return path.join(projectRoot, '.hexos', 'manifest.json');
}

export async function readManifest(projectRoot: string): Promise<HexosManifest | null> {
    const manifestPath = getManifestPath(projectRoot);
    if (!(await fs.pathExists(manifestPath))) {
        return null;
    }

    const manifest = (await fs.readJson(manifestPath)) as HexosManifest;
    validateManifest(manifest);
    return manifest;
}

export async function writeManifest(
    projectRoot: string,
    manifest: HexosManifest,
    dryRun: boolean,
): Promise<void> {
    if (dryRun) {
        return;
    }

    const manifestPath = getManifestPath(projectRoot);
    await fs.ensureDir(path.dirname(manifestPath));
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function hashContent(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function hashFile(filePath: string): Promise<string | null> {
    if (!(await fs.pathExists(filePath))) {
        return null;
    }
    const content = await fs.readFile(filePath, 'utf8');
    return hashContent(content);
}

export function buildManagedMetadata(content: string, strategy: ManagedFileMetadata['strategy']): ManagedFileMetadata {
    return {
        sha256: hashContent(content),
        strategy,
    };
}

function validateManifest(manifest: HexosManifest): void {
    if (manifest.schemaVersion !== 1) {
        throw new Error(`Unsupported manifest schema version: ${String((manifest as any).schemaVersion)}`);
    }

    if (!manifest.hexosVersion || !manifest.installConfig || !manifest.managedFiles) {
        throw new Error('Invalid Hexos manifest: required fields are missing.');
    }
}
