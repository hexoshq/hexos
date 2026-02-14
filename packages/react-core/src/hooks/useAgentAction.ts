import { useEffect, useCallback, useState, useRef } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import {
  frontendToolsAtom,
  addExecutingActionAtom,
  updateExecutingActionAtom,
  removeExecutingActionAtom,
} from '../atoms/index.js';
import type { ActionDefinition, UseAgentActionReturn } from '../types.js';

export type { UseAgentActionReturn } from '../types.js';

/**
 * @description
 * Hook that registers a frontend action the agent can trigger, with optimistic update support.
 *
 * Actions are like {@link FrontendToolDefinition}s but designed for state mutations.
 * They support optimistic updates (apply changes immediately before the async handler
 * resolves) and automatic rollback on errors. An optional `confirmationMessage` triggers
 * a confirmation dialog before execution.
 *
 * The action is registered in {@link frontendToolsAtom} so the agent can invoke it.
 * Execution state is tracked globally in {@link executingActionsAtom} for observability.
 * The action is automatically unregistered when the component unmounts.
 *
 * Related: {@link ActionDefinition} defines the action structure,
 * {@link useAgentTool} is for read-only tools, {@link ActionConfirmDialog} renders
 * confirmation UI when `confirmationMessage` is set.
 *
 * @param definition - The action definition with handler, schema, and optional optimistic update
 * @returns Object with execute function, execution state, and error handling — see {@link UseAgentActionReturn}
 *
 * @example
 * ```tsx
 * const { execute, isExecuting, error } = useAgentAction({
 *   name: 'add_todo_item',
 *   description: 'Adds a new item to the todo list',
 *   inputSchema: z.object({
 *     title: z.string(),
 *     priority: z.enum(['low', 'medium', 'high']),
 *   }),
 *   handler: async (input) => {
 *     await api.createTodoItem(input);
 *   },
 *   optimisticUpdate: (input) => {
 *     setItems(prev => [...prev, { ...input, id: 'temp-' + Date.now(), status: 'pending' }]);
 *   },
 *   rollback: (input, error) => {
 *     setItems(prev => prev.filter(item => !item.id.startsWith('temp-')));
 *     toast.error('Failed to add item: ' + error.message);
 *   },
 * });
 * ```
 *
 * @docsCategory hooks
 */
export function useAgentAction<TInput>(
  definition: ActionDefinition<TInput>
): UseAgentActionReturn<TInput> {
  const [, setTools] = useAtom(frontendToolsAtom);
  const addExecutingAction = useSetAtom(addExecutingActionAtom);
  const updateExecutingAction = useSetAtom(updateExecutingActionAtom);
  const removeExecutingAction = useSetAtom(removeExecutingActionAtom);

  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] = useState<unknown>(null);

  // Store definition in ref to avoid stale closures
  const definitionRef = useRef(definition);
  definitionRef.current = definition;

  // Execute the action with optimistic update support
  const execute = useCallback(
    async (input: TInput) => {
      const def = definitionRef.current;
      const actionId = crypto.randomUUID();

      setIsExecuting(true);
      setError(null);

      // Track in global state
      addExecutingAction({
        id: actionId,
        name: def.name,
        args: input,
        status: 'executing',
        startedAt: new Date(),
      });

      // Apply optimistic update synchronously
      if (def.optimisticUpdate) {
        try {
          def.optimisticUpdate(input);
        } catch (err) {
          console.warn('Optimistic update failed:', err);
        }
      }

      try {
        await def.handler(input);

        // Update global state
        updateExecutingAction({
          id: actionId,
          status: 'completed',
          completedAt: new Date(),
        });

        setLastResult({ success: true });

        // Remove from tracking after a short delay
        setTimeout(() => removeExecutingAction(actionId), 1000);
      } catch (err) {
        const actionError = err instanceof Error ? err : new Error(String(err));

        // Rollback on error
        if (def.rollback) {
          try {
            def.rollback(input, actionError);
          } catch (rollbackErr) {
            console.warn('Rollback failed:', rollbackErr);
          }
        }

        // Update global state
        updateExecutingAction({
          id: actionId,
          status: 'failed',
          error: actionError.message,
          completedAt: new Date(),
        });

        setError(actionError);

        // Remove from tracking after a delay
        setTimeout(() => removeExecutingAction(actionId), 3000);

        throw actionError;
      } finally {
        setIsExecuting(false);
      }
    },
    [addExecutingAction, updateExecutingAction, removeExecutingAction]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Store execute in ref to avoid recreating wrappedAction
  const executeRef = useRef(execute);
  executeRef.current = execute;

  // Store the action name for cleanup - this is the only stable identifier
  const actionNameRef = useRef(definition.name);
  actionNameRef.current = definition.name;

  useEffect(() => {
    const def = definitionRef.current;
    const actionName = def.name;

    // Wrap the action for registration as a frontend tool
    // Use executeRef to avoid dependency on execute callback
    const wrappedAction = async (input: TInput) => {
      try {
        await executeRef.current(input);
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    };

    // Register as a frontend tool
    setTools((prev) => {
      const next = new Map(prev);
      next.set(actionName, {
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema,
        execute: wrappedAction,
        requiresApproval: !!def.confirmationMessage,
        // Store the confirmation message for the dialog
        _confirmationMessage: def.confirmationMessage,
      });
      return next;
    });

    return () => {
      setTools((prev) => {
        const next = new Map(prev);
        next.delete(actionName);
        return next;
      });
    };
    // Only re-register when the action name changes
    // Other properties are accessed via definitionRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.name, setTools]);

  return {
    execute,
    isExecuting,
    error,
    lastResult,
    clearError,
  };
}
