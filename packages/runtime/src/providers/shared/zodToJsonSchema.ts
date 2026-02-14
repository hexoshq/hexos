/**
 * @description
 * Converts Zod schemas to JSON Schema format for LLM tool definitions.
 *
 * Handles three cases: already-converted JSON Schema objects (pass-through),
 * ZodObject instances (introspects shape and converts to JSON Schema), and
 * unknown schemas (returns empty object schema). Supports string, number, and
 * boolean primitive types, optional fields, and field descriptions.
 *
 * This conversion is required because LLM providers expect tool input schemas
 * in JSON Schema format, while Hexos uses Zod for runtime validation.
 *
 * @param schema - Zod schema or JSON Schema object to convert
 * @param debug - Enable debug logging to console
 *
 * @returns JSON Schema object with type, properties, and required fields
 *
 * @see {@link ToolDefinition} for usage in tool definitions
 *
 * @docsCategory llm-providers
 */
export function zodToJsonSchema(schema: unknown, debug = false): Record<string, unknown> {
  if (debug) {
    console.log('[zodToJsonSchema] Input schema:', JSON.stringify(schema, null, 2));
  }

  const jsonSchema = schema as { type?: string; properties?: Record<string, unknown> };
  if (jsonSchema?.type === 'object' && jsonSchema?.properties !== undefined) {
    if (debug) {
      console.log('[zodToJsonSchema] Already JSON Schema, returning as-is');
    }
    return schema as Record<string, unknown>;
  }

  const zodSchema = schema as {
    _def?: { typeName?: string; shape?: () => Record<string, unknown> };
  };

  if (zodSchema?._def?.typeName === 'ZodObject') {
    const shape = zodSchema._def.shape?.() ?? {};
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const fieldDef = value as {
        _def?: { typeName?: string; description?: string; innerType?: unknown };
      };
      const isOptional = fieldDef?._def?.typeName === 'ZodOptional';
      const innerType = isOptional ? fieldDef?._def?.innerType : value;
      const innerDef = (innerType as { _def?: { typeName?: string; description?: string } })?._def;

      let type = 'string';
      if (innerDef?.typeName === 'ZodNumber') type = 'number';
      if (innerDef?.typeName === 'ZodBoolean') type = 'boolean';

      properties[key] = {
        type,
        description: innerDef?.description ?? fieldDef?._def?.description,
      };

      if (!isOptional) {
        required.push(key);
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
  }

  return { type: 'object', properties: {} };
}
