import type { ToolDefinition } from '@hexos/common';

/**
 * @description
 * Ollama-specific tool definition format for function calling.
 *
 * @docsCategory llm-providers
 */
export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * @description
 * Converts Hexos tool definitions to Ollama's function calling format.
 *
 * Transforms internal ToolDefinition objects into the format expected by Ollama's
 * chat API. Each tool is mapped to a function definition with its name, description,
 * and Zod schema converted to JSON Schema format.
 *
 * @param tools - Array of Hexos tool definitions to convert
 * @param toJsonSchema - Function that converts Zod schemas to JSON Schema format (typically zodToJsonSchema)
 * @returns Array of tools in Ollama's tool format
 *
 * @docsCategory llm-providers
 *
 * @see {@link ToolDefinition} for the internal tool definition structure
 * @see {@link https://github.com/ollama/ollama/blob/main/docs/api.md#chat-request-with-tools | Ollama Function Calling}
 */
export function convertToolsToOllamaFormat(
  tools: ToolDefinition[],
  toJsonSchema: (schema: unknown) => Record<string, unknown>
): OllamaTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toJsonSchema(tool.inputSchema),
    },
  }));
}
