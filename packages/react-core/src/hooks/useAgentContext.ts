import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { updateContextAtom, removeContextAtom } from '../atoms/index.js';
import type { ContextDefinition } from '../types.js';

/**
 * @description
 * Hook that registers a context entry to be sent with every agent request.
 *
 * Provides the agent with information about the current application state
 * (e.g., current page, user preferences, selected items). The context is stored
 * in {@link frontendContextAtom} and included in every {@link TransportMessage}.
 *
 * When the component unmounts, the context entry is automatically removed unless
 * `persistent` is set to true (default). Persistent context survives component
 * unmounting and is only removed explicitly.
 *
 * Related: {@link ContextDefinition} defines the entry structure,
 * {@link updateContextAtom} and {@link removeContextAtom} manage the store,
 * {@link useAgent} includes the context when sending messages.
 *
 * @param definition - The context entry to register
 *
 * @example
 * ```tsx
 * useAgentContext({
 *   key: 'current_page',
 *   description: 'The current page the user is viewing',
 *   value: { route: '/dashboard', title: 'Dashboard' },
 *   priority: 10,
 * });
 * ```
 *
 * @docsCategory hooks
 */
export function useAgentContext(definition: ContextDefinition): void {
  const updateContext = useSetAtom(updateContextAtom);
  const removeContext = useSetAtom(removeContextAtom);

  useEffect(() => {
    // Add context
    updateContext({
      key: definition.key,
      value: {
        description: definition.description,
        value: definition.value,
        priority: definition.priority ?? 0,
        persistent: definition.persistent ?? true,
      },
    });

    // Clean up on unmount (unless persistent)
    return () => {
      if (!definition.persistent) {
        removeContext(definition.key);
      }
    };
  }, [definition.key, definition.value, definition.description, definition.priority, definition.persistent, updateContext, removeContext]);
}
