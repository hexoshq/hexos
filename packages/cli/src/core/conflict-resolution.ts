import { cancel, isCancel, select } from '@clack/prompts';
import fs from 'fs-extra';
import path from 'path';
import pc from 'picocolors';

import { mergeEnvContent } from './env-utils';
import { hashContent } from './manifest';
import { HexosManifest, PlannedFile } from '../types';

export interface FileActionPlanItem {
    relativePath: string;
    strategy: PlannedFile['strategy'];
    desiredContent: string;
    finalContent: string;
    changed: boolean;
    reason: 'create' | 'update' | 'unchanged';
    conflict: boolean;
    conflictMessage?: string;
}

export interface ConflictResolution {
    overwrite: Set<string>;
    keep: Set<string>;
}

export async function buildFileActionPlan(options: {
    projectRoot: string;
    plannedFiles: PlannedFile[];
    mode: 'install' | 'upgrade';
    manifest: HexosManifest | null;
    force?: boolean;
}): Promise<FileActionPlanItem[]> {
    const { projectRoot, plannedFiles, mode, manifest, force = false } = options;

    const plans: FileActionPlanItem[] = [];

    for (const plannedFile of plannedFiles) {
        const targetPath = path.join(projectRoot, plannedFile.relativePath);
        const exists = await fs.pathExists(targetPath);
        const existingContent = exists ? await fs.readFile(targetPath, 'utf8') : null;

        const finalContent =
            plannedFile.strategy === 'merge-env'
                ? mergeEnvContent(existingContent, plannedFile.content)
                : plannedFile.content;

        const changed = existingContent === null ? true : existingContent !== finalContent;
        const reason = existingContent === null ? 'create' : changed ? 'update' : 'unchanged';

        let conflict = false;
        let conflictMessage: string | undefined;

        if (!force && changed && plannedFile.strategy === 'overwrite' && existingContent !== null) {
            if (mode === 'install') {
                conflict = true;
                conflictMessage = 'File already exists and would be modified during install.';
            } else {
                const manifestEntry = manifest?.managedFiles[plannedFile.relativePath];
                if (!manifestEntry) {
                    conflict = true;
                    conflictMessage = 'File is not tracked in manifest.';
                } else {
                    const currentHash = hashContent(existingContent);
                    if (currentHash !== manifestEntry.sha256) {
                        conflict = true;
                        conflictMessage = 'File changed since last managed state.';
                    }
                }
            }
        }

        plans.push({
            relativePath: plannedFile.relativePath,
            strategy: plannedFile.strategy,
            desiredContent: plannedFile.content,
            finalContent,
            changed,
            reason,
            conflict,
            conflictMessage,
        });
    }

    return plans;
}

export async function resolveConflicts(options: {
    plans: FileActionPlanItem[];
    nonInteractive: boolean;
    force?: boolean;
}): Promise<ConflictResolution> {
    const { plans, nonInteractive, force = false } = options;
    const conflicts = plans.filter(plan => plan.conflict);

    if (force || conflicts.length === 0) {
        return {
            overwrite: new Set(conflicts.map(conflict => conflict.relativePath)),
            keep: new Set(),
        };
    }

    if (nonInteractive) {
        const lines = conflicts
            .map(conflict => `- ${conflict.relativePath}: ${conflict.conflictMessage ?? 'conflict'}`)
            .join('\n');
        throw new Error(
            `Conflicts detected in non-interactive mode:\n${lines}\nRe-run without --yes to resolve, or use --force to overwrite.`,
        );
    }

    const overwrite = new Set<string>();
    const keep = new Set<string>();

    for (const conflict of conflicts) {
        const action = await select({
            message: `Conflict in ${pc.cyan(conflict.relativePath)}. Choose an action:`,
            options: [
                {
                    value: 'overwrite',
                    label: 'Overwrite',
                    hint: 'Replace current content with Hexos managed file',
                },
                {
                    value: 'keep',
                    label: 'Keep existing',
                    hint: 'Skip this file in this run',
                },
                {
                    value: 'abort',
                    label: 'Abort',
                    hint: 'Stop command without applying further changes',
                },
            ],
        });

        if (isCancel(action) || action === 'abort') {
            cancel('Operation cancelled.');
            throw new Error('Operation cancelled by user.');
        }

        if (action === 'overwrite') {
            overwrite.add(conflict.relativePath);
        } else {
            keep.add(conflict.relativePath);
        }
    }

    return { overwrite, keep };
}

export function getWritablePlans(
    plans: FileActionPlanItem[],
    resolution: ConflictResolution,
): FileActionPlanItem[] {
    return plans.filter(plan => {
        if (!plan.changed) {
            return false;
        }
        if (!plan.conflict) {
            return true;
        }
        return resolution.overwrite.has(plan.relativePath);
    });
}

export function getSkippedConflictPaths(
    plans: FileActionPlanItem[],
    resolution: ConflictResolution,
): string[] {
    return plans
        .filter(plan => plan.conflict && resolution.keep.has(plan.relativePath))
        .map(plan => plan.relativePath)
        .sort();
}
