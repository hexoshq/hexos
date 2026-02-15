import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['packages/cli/e2e/**/*.e2e-spec.ts'],
        testTimeout: 60000,
    },
});
