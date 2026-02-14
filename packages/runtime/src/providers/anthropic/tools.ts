import Anthropic from '@anthropic-ai/sdk';
import type { ToolDefinition } from '@hexos/common';

/**
 * @description
 * Converts Hexos tool definitions to Anthropic's tool format.
 *
 * Transforms each tool's name, description, and Zod input schema into the
 * format required by the Anthropic Messages API. The schema conversion function
 * is injected to handle Zod-to-JSON Schema transformation.
 *
 * This conversion is performed once per agent stream initialization, before
 * calling the Anthropic API.
 *
 * @param tools - Array of Hexos tool definitions
 * @param toJsonSchema - Function to convert Zod schemas to JSON Schema
 *
 * @returns Array of Anthropic tool definitions
 *
 * @see {@link ToolDefinition} for Hexos tool structure
 * @see {@link zodToJsonSchema} for schema conversion
 *
 * @docsCategory llm-providers
 */
export function convertToolsToAnthropicFormat(
  tools: ToolDefinition[],
  toJsonSchema: (schema: unknown) => Record<string, unknown>
): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: toJsonSchema(tool.inputSchema) as Anthropic.Tool['input_schema'],
  }));
}
