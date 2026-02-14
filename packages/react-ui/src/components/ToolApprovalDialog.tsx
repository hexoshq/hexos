import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { ToolApprovalRequest } from '@hexos/react-core';
import { Button } from '../primitives/Button.js';

/**
 * @description
 * Props for the {@link ToolApprovalDialog} component.
 *
 * @docsCategory ui-components
 */
export interface ToolApprovalDialogProps {
  request: ToolApprovalRequest;
  onApprove: () => void;
  onReject: (reason?: string) => void;
  isSubmitting?: boolean;
  error?: Error | null;
  className?: string;
}

/**
 * @description
 * Modal dialog for approving or rejecting tool execution requests.
 *
 * Uses Radix UI Dialog for accessibility including focus trap, Escape key handling, and proper
 * ARIA attributes. Displays tool name, agent ID, and JSON-formatted arguments for user review.
 *
 * Two-step rejection flow: first click shows a text input for optional reason, second click
 * confirms rejection with the provided reason. Approve action executes immediately.
 *
 * The dialog prevents outside clicks to ensure explicit user decision. Escape key triggers
 * rejection without reason. During submission, all interactive elements are disabled and
 * button labels change to "Processing...".
 *
 * Related types: {@link ToolApprovalRequest}, {@link ApprovalDecision} from `@hexos/react-core`
 *
 * @example
 * ```tsx
 * <ToolApprovalDialog
 *   request={{
 *     toolCallId: '123',
 *     toolName: 'delete_file',
 *     agentId: 'main',
 *     args: { path: '/data/file.txt' }
 *   }}
 *   onApprove={() => approveExecution()}
 *   onReject={(reason) => rejectExecution(reason)}
 *   isSubmitting={isSubmitting}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function ToolApprovalDialog({
  request,
  onApprove,
  onReject,
  isSubmitting = false,
  error = null,
  className = '',
}: ToolApprovalDialogProps): React.ReactElement {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleReject = () => {
    if (showRejectInput) {
      onReject(rejectReason || undefined);
    } else {
      setShowRejectInput(true);
    }
  };

  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`hexos-approval-dialog ${className} ax-fixed ax-inset-0 ax-bg-black/50 ax-z-50`}
        />
        <Dialog.Content
          onEscapeKeyDown={() => onReject()}
          onInteractOutside={(e) => e.preventDefault()}
          className="ax-fixed ax-z-50 ax-top-1/2 ax-left-1/2 ax--translate-x-1/2 ax--translate-y-1/2 ax-bg-white ax-rounded-xl ax-max-w-lg ax-w-[90%] ax-p-6"
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
        >
          {/* Header */}
          <div className="ax-mb-4">
            <Dialog.Title className="ax-m-0 ax-text-lg ax-font-semibold ax-text-gray-900">
              Tool Approval Required
            </Dialog.Title>
            <Dialog.Description className="ax-mt-2 ax-mb-0 ax-text-sm ax-text-gray-500">
              The agent wants to execute the following tool:
            </Dialog.Description>
          </div>

          {/* Tool info */}
          <div className="ax-bg-gray-50 ax-rounded-lg ax-p-4 ax-mb-4">
            <div className="ax-flex ax-items-center ax-gap-2 ax-mb-3">
              <span className="ax-font-mono ax-font-semibold ax-text-base ax-text-gray-800">
                {request.toolName}
              </span>
              <span className="ax-text-xs ax-text-gray-500">
                via {request.agentId}
              </span>
            </div>

            <div>
              <div className="ax-text-xs ax-text-gray-500 ax-mb-1">
                Arguments
              </div>
              <pre className="ax-m-0 ax-p-2 ax-bg-white ax-rounded ax-border ax-border-gray-200 ax-overflow-auto ax-text-xs ax-font-mono ax-max-h-[200px]">
                {JSON.stringify(request.args, null, 2)}
              </pre>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="ax-mb-4 ax-p-3 ax-bg-red-50 ax-border ax-border-red-200 ax-rounded-md ax-text-red-600 ax-text-sm">
              {error.message}
            </div>
          )}

          {/* Reject reason input */}
          {showRejectInput && (
            <div className="ax-mb-4">
              <label className="ax-block ax-text-sm ax-text-gray-700 ax-mb-1">
                Reason for rejection (optional)
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason..."
                disabled={isSubmitting}
                className="ax-w-full ax-px-3 ax-py-2 ax-border ax-border-gray-200 ax-rounded-md ax-text-sm"
                style={{ opacity: isSubmitting ? 0.6 : 1 }}
                autoFocus
              />
            </div>
          )}

          {/* Actions */}
          <div className="ax-flex ax-gap-3 ax-justify-end">
            <Button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting}
              variant={showRejectInput ? 'destructive' : 'outline'}
            >
              {isSubmitting ? 'Processing...' : showRejectInput ? 'Confirm Reject' : 'Reject'}
            </Button>
            {showRejectInput && (
              <Button
                type="button"
                onClick={() => {
                  setShowRejectInput(false);
                  setRejectReason('');
                }}
                disabled={isSubmitting}
                variant="outline"
              >
                Cancel
              </Button>
            )}
            {!showRejectInput && (
              <Button
                type="button"
                onClick={onApprove}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Approve'}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
