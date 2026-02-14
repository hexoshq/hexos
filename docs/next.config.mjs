import nextra from 'nextra';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
});

const BRANCH_NAME = process.env.VERCEL_GIT_COMMIT_REF || '';
const IS_RELEASE_BRANCH = BRANCH_NAME.startsWith('releases/');

export default withNextra({
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [];
  },
  transpilePackages: ['@hexos/runtime'],
  basePath: IS_RELEASE_BRANCH
    ? `/v/${packageJson.version}`
    : process.env.NEXT_PUBLIC_IS_CANARY
      ? '/v/canary'
      : '',
});
