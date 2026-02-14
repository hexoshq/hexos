import Anthropic from '@anthropic-ai/sdk';

/**
 * @description
 * Creates an authenticated Anthropic SDK client instance.
 *
 * Initializes the Anthropic client using the ANTHROPIC_API_KEY environment
 * variable. This factory function is used by the runtime to create provider
 * instances for Anthropic-based agents.
 *
 * @returns Configured Anthropic client instance
 *
 * @see {@link ModelConfig} for model configuration
 *
 * @docsCategory llm-providers
 */
export function createAnthropicClient(): Anthropic {
  return new Anthropic();
}
