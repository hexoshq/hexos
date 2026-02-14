import type { ToolDefinition } from '@hexos/common';
import OpenAI from 'openai';

/**
 * @description
 * Converts Hexos tool definitions to OpenAI's chat completion tool format.
 *
 * Transforms internal ToolDefinition objects into the format expected by OpenAI's
 * chat completion API. Each tool is mapped to a function definition with its name,
 * description, and Zod schema converted to JSON Schema format.
 *
 * @param tools - Array of Hexos tool definitions to convert
 * @param toJsonSchema - Function that converts Zod schemas to JSON Schema format (typically zodToJsonSchema)
 * @returns Array of tools in OpenAI's ChatCompletionTool format
 *
 * @docsCategory llm-providers
 *
 * @see {@link ToolDefinition} for the internal tool definition structure
 * @see {@link https://platform.openai.com/docs/guides/function-calling | OpenAI Function Calling}
 */
export function convertToolsToOpenAIFormat(
  tools: ToolDefinition[],
  toJsonSchema: (schema: unknown) => Record<string, unknown>
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: toJsonSchema(tool.inputSchema),
    },
  }));
}
