import { Ollama } from 'ollama';

/**
 * @description
 * Creates an Ollama client instance for local LLM inference.
 *
 * Initializes the Ollama SDK client with a configurable host endpoint. Defaults to
 * localhost:11434 but can be overridden via the OLLAMA_HOST environment variable to
 * connect to remote Ollama instances.
 *
 * @returns An initialized Ollama client instance
 *
 * @docsCategory llm-providers
 *
 * @see {@link ModelConfig} for model configuration options
 * @see {@link https://github.com/ollama/ollama | Ollama Documentation}
 */
export function createOllamaClient(): Ollama {
  return new Ollama({ host: process.env.OLLAMA_HOST ?? 'http://localhost:11434' });
}
