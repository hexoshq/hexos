import OpenAI from 'openai';

/**
 * @description
 * Creates an OpenAI client instance for LLM API communication.
 *
 * Initializes the OpenAI SDK client using the OPENAI_API_KEY environment variable.
 * The client is used by the OpenAI provider to make chat completion requests.
 *
 * @returns An initialized OpenAI client instance
 *
 * @docsCategory llm-providers
 *
 * @see {@link ModelConfig} for model configuration options
 * @see {@link https://platform.openai.com/docs/api-reference | OpenAI API Reference}
 */
export function createOpenAIClient(): OpenAI {
  return new OpenAI();
}
