export const REQUIRED_NODE_VERSION = '>=20.0.0';

export const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

export const HEXOS_DEPENDENCIES = [
    '@hexos/common',
    '@hexos/react-core',
    '@hexos/react-ui',
    '@hexos/runtime',
] as const;

export const OPTIONAL_PROVIDER_DEPENDENCIES = {
    anthropic: ['@langchain/anthropic@>=0.3.0'],
    openai: ['@langchain/openai@>=0.3.0'],
    ollama: [],
} as const;

export const SUPPORT_MESSAGE = 'https://hexos.xyz/docs';
