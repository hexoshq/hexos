import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { frontendToolsAtom } from '../atoms/index.js';
import type { FrontendToolDefinition } from '../types.js';

/**
 * @description
 * Hook that registers a frontend tool the agent can call for browser-side execution.
 *
 * Frontend tools execute in the browser rather than on the server, providing access
 * to browser APIs (clipboard, geolocation, DOM, etc.). When the LLM invokes a tool
 * whose name matches a registered frontend tool, {@link useAgent} detects the match
 * in {@link frontendToolsAtom} and executes it locally.
 *
 * The tool is automatically unregistered when the component unmounts.
 *
 * Related: {@link FrontendToolDefinition} defines the tool structure,
 * {@link frontendToolsAtom} stores the registry, {@link useAgent} orchestrates execution.
 *
 * @param definition - The frontend tool definition including name, schema, execute function, and optional render
 *
 * @example
 * ```tsx
 * useAgentTool({
 *   name: 'get_clipboard',
 *   description: 'Read the current clipboard contents',
 *   inputSchema: z.object({}),
 *   execute: async () => {
 *     return await navigator.clipboard.readText();
 *   },
 *   render: ({ output }) => <code>{output}</code>,
 * });
 * ```
 *
 * @docsCategory hooks
 */
export function useAgentTool<TInput, TOutput>(
  definition: FrontendToolDefinition<TInput, TOutput>
): void {
  const [, setTools] = useAtom(frontendToolsAtom);

  useEffect(() => {
    // Register the tool
    setTools((prev) => {
      const next = new Map(prev);
      next.set(definition.name, definition);
      return next;
    });

    // Unregister on unmount
    return () => {
      setTools((prev) => {
        const next = new Map(prev);
        next.delete(definition.name);
        return next;
      });
    };
  }, [definition.name, definition, setTools]);
}

/**
 * @description
 * Hook that retrieves a registered frontend tool by name.
 *
 * Returns the {@link FrontendToolDefinition} if a tool with the given name is registered
 * in {@link frontendToolsAtom}, or `undefined` if not found.
 *
 * @param name - The name of the frontend tool to retrieve
 * @returns The tool definition, or undefined if not registered
 *
 * @docsCategory hooks
 */
export function useFrontendTool<TInput, TOutput>(
  name: string
): FrontendToolDefinition<TInput, TOutput> | undefined {
  const [tools] = useAtom(frontendToolsAtom);
  return tools.get(name) as FrontendToolDefinition<TInput, TOutput> | undefined;
}

/**
 * @description
 * Hook that returns all currently registered frontend tools.
 *
 * Returns an array of all {@link FrontendToolDefinition} entries from {@link frontendToolsAtom}.
 *
 * @returns Array of all registered frontend tool definitions
 *
 * @docsCategory hooks
 */
export function useFrontendTools(): FrontendToolDefinition[] {
  const [tools] = useAtom(frontendToolsAtom);
  return Array.from(tools.values()) as FrontendToolDefinition[];
}
