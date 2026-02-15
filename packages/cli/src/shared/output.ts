import { log } from '@clack/prompts';
import pc from 'picocolors';

export function info(message: string) {
    log.info(message);
}

export function success(message: string) {
    log.success(message);
}

export function warn(message: string) {
    log.warn(message);
}

export function error(message: string): never {
    log.error(pc.red(message));
    throw new Error(message);
}

export function formatPath(path: string): string {
    return pc.cyan(path);
}
