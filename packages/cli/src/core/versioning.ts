export function getDefaultHexosVersion(): string {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const runtimePackage = require('@hexos/runtime/package.json') as { version?: string };
        if (runtimePackage.version) {
            return runtimePackage.version;
        }
    } catch (_error) {
        // ignore
    }

    return 'latest';
}
