/**
 * @description
 * Enumerates the supported LLM provider backends.
 *
 * Used in {@link ModelConfig} to select which provider handles LLM calls.
 * Each provider has a corresponding client factory and streaming implementation
 * in the `@hexos/runtime` package.
 *
 * @docsCategory core-types
 */
export enum LLMProvider {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Ollama = 'ollama',
  Google = 'google',
  Azure = 'azure',
}

/**
 * @description
 * Available OpenAI model identifiers for use with {@link LLMProvider.OpenAI}.
 *
 * These values map directly to the OpenAI API `model` parameter. Select a model
 * based on capability and cost tradeoffs for your use case.
 *
 * @docsCategory core-types
 */
export enum OpenAIModel {
  GPT4o = 'gpt-4o',
  GPT4oMini = 'gpt-4o-mini',
  GPT4Turbo = 'gpt-4-turbo',
  GPT4 = 'gpt-4',
  GPT35Turbo = 'gpt-3.5-turbo',
}

/**
 * @description
 * Available Anthropic model identifiers for use with {@link LLMProvider.Anthropic}.
 *
 * These values map directly to the Anthropic API `model` parameter.
 *
 * @docsCategory core-types
 */
export enum AnthropicModel {
  Claude4Sonnet = 'claude-sonnet-4-20250514',
  Claude37Sonnet = 'claude-3-7-sonnet-20250219',
  Claude3Opus = 'claude-3-opus-20240229',
  Claude3Sonnet = 'claude-3-sonnet-20240229',
  Claude3Haiku = 'claude-3-haiku-20240307',
}

/**
 * @description
 * Available Ollama model identifiers for use with {@link LLMProvider.Ollama}.
 *
 * These values map to locally-hosted models via the Ollama runtime.
 * Custom models can also be specified as a plain string in {@link ModelConfig}.
 *
 * @docsCategory core-types
 */
export enum OllamaModel {
  Llama3 = 'llama3',
  Llama31 = 'llama3.1',
  Llama32 = 'llama3.2',
  Mistral = 'mistral',
  Mixtral = 'mixtral',
  CodeLlama = 'codellama',
  Phi = 'phi',
  Gemma = 'gemma',
  Qwen = 'qwen',
}

/**
 * @description
 * Configuration for an LLM provider connection, specifying which model to use and how to connect.
 *
 * Each {@link AgentDefinition} requires a ModelConfig to determine its LLM backend.
 * The `apiKey` field supports both static strings and async functions for dynamic
 * key retrieval (e.g., from a secrets manager). The `baseUrl` field enables custom
 * endpoints for proxies or self-hosted providers.
 *
 * Related: {@link LLMProvider} determines the provider, {@link AgentDefinition} uses this config.
 *
 * @docsCategory agent-config
 */
export interface ModelConfig {
  provider: LLMProvider;
  model: string;
  temperature?: number;
  maxTokens?: number;
  apiKey?: string | (() => Promise<string>);
  baseUrl?: string;
}
