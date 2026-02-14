import { useCallback, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { pendingToolCallsAtom, removePendingApprovalAtom, transportAtom } from '../atoms/index.js';
import type { ToolApprovalRequest } from '../types.js';

/**
 * @description
 * Return type of the {@link useToolApproval} hook, providing approval controls and state.
 *
 * @docsCategory hooks
 */
export interface UseToolApprovalReturn {
  /** Pending approval requests */
  pending: ToolApprovalRequest[];
  /** Approve a tool call */
  approve: (toolCallId: string) => Promise<void>;
  /** Reject a tool call */
  reject: (toolCallId: string, reason?: string) => Promise<void>;
  /** Approve all pending */
  approveAll: () => Promise<void>;
  /** Reject all pending */
  rejectAll: (reason?: string) => Promise<void>;
  /** Whether an approval operation is in progress */
  isSubmitting: boolean;
  /** Error from last approval operation */
  error: Error | null;
  /** Clear the error */
  clearError: () => void;
}

/**
 * @description
 * Hook for managing human-in-the-loop tool approval workflows.
 *
 * Provides access to pending {@link ToolApprovalRequest}s and methods to approve or
 * reject them. Sends {@link ApprovalDecision}s to the server via the {@link AgentTransport}
 * stored in {@link transportAtom}, and removes resolved requests from {@link pendingToolCallsAtom}.
 *
 * Includes batch operations (`approveAll`, `rejectAll`) and submission state tracking.
 *
 * Related: {@link ToolApprovalDialog} renders the approval UI, {@link pendingToolCallsAtom}
 * stores pending requests, {@link SSETransport}.sendApproval() transmits decisions,
 * {@link AgentRuntime}.submitApproval() processes them server-side.
 *
 * @returns Object with pending requests, approve/reject functions, and state — see {@link UseToolApprovalReturn}
 *
 * @example
 * ```tsx
 * function ApprovalDialog() {
 *   const { pending, approve, reject, isSubmitting } = useToolApproval();
 *
 *   return (
 *     <>
 *       {pending.map((request) => (
 *         <Dialog key={request.toolCallId}>
 *           <p>Allow {request.toolName}?</p>
 *           <button
 *             onClick={() => approve(request.toolCallId)}
 *             disabled={isSubmitting}
 *           >
 *             Allow
 *           </button>
 *           <button
 *             onClick={() => reject(request.toolCallId, 'User denied')}
 *             disabled={isSubmitting}
 *           >
 *             Deny
 *           </button>
 *         </Dialog>
 *       ))}
 *     </>
 *   );
 * }
 * ```
 *
 * @docsCategory hooks
 */
export function useToolApproval(): UseToolApprovalReturn {
  const [pending] = useAtom(pendingToolCallsAtom);
  const removePendingApproval = useSetAtom(removePendingApprovalAtom);
  const transport = useAtomValue(transportAtom);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const approve = useCallback(
    async (toolCallId: string) => {
      if (!transport) {
        setError(new Error('Transport not connected'));
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await transport.sendApproval({
          toolCallId,
          approved: true,
        });
        removePendingApproval(toolCallId);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsSubmitting(false);
      }
    },
    [transport, removePendingApproval]
  );

  const reject = useCallback(
    async (toolCallId: string, reason?: string) => {
      if (!transport) {
        setError(new Error('Transport not connected'));
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await transport.sendApproval({
          toolCallId,
          approved: false,
          reason,
        });
        removePendingApproval(toolCallId);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsSubmitting(false);
      }
    },
    [transport, removePendingApproval]
  );

  const approveAll = useCallback(async () => {
    for (const request of pending) {
      await approve(request.toolCallId);
    }
  }, [pending, approve]);

  const rejectAll = useCallback(
    async (reason?: string) => {
      for (const request of pending) {
        await reject(request.toolCallId, reason);
      }
    },
    [pending, reject]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    pending,
    approve,
    reject,
    approveAll,
    rejectAll,
    isSubmitting,
    error,
    clearError,
  };
}
