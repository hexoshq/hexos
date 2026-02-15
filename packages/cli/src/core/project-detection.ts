import fs from 'fs-extra';
import path from 'path';
import semver from 'semver';

import { REQUIRED_NODE_VERSION } from '../constants';

interface PackageJsonLike {
    name?: string;
    description?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
}

export interface ProjectInfo {
    rootDir: string;
    packageJsonPath: string;
    packageJson: PackageJsonLike;
}

export function assertNodeVersion(requiredVersion: string = REQUIRED_NODE_VERSION): void {
    if (!semver.satisfies(process.version, requiredVersion)) {
        throw new Error(
            `Node ${process.version} is not supported. Hexos CLI requires Node ${requiredVersion}.`,
        );
    }
}

export async function resolveProjectInfo(projectPath?: string): Promise<ProjectInfo> {
    const rootDir = path.resolve(projectPath ?? process.cwd());
    const packageJsonPath = path.join(rootDir, 'package.json');

    if (!(await fs.pathExists(packageJsonPath))) {
        throw new Error(`No package.json found at ${packageJsonPath}.`);
    }

    const packageJson = (await fs.readJson(packageJsonPath)) as PackageJsonLike;

    return {
        rootDir,
        packageJsonPath,
        packageJson,
    };
}

export async function assertNextAppRouterProject(projectPath?: string): Promise<ProjectInfo> {
    const projectInfo = await resolveProjectInfo(projectPath);
    const appDirPath = path.join(projectInfo.rootDir, 'app');

    const hasNextDependency = hasDependency(projectInfo.packageJson, 'next');

    if (!hasNextDependency) {
        throw new Error('This project does not look like a Next.js project (missing next/react dependencies).');
    }

    if (!(await fs.pathExists(appDirPath))) {
        throw new Error(`This project does not use Next.js App Router (missing ${appDirPath}).`);
    }

    return projectInfo;
}

function hasDependency(packageJson: PackageJsonLike, dependencyName: string): boolean {
    return Boolean(
        packageJson.dependencies?.[dependencyName] ||
            packageJson.devDependencies?.[dependencyName] ||
            packageJson.peerDependencies?.[dependencyName],
    );
}
