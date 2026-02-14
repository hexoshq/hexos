import React from 'react';
import { useToolApproval } from '@hexos/react-core';
import { ToolApprovalDialog } from './ToolApprovalDialog.js';
import { Button } from '../primitives/Button.js';

/**
 * @description
 * Props for the {@link ToolApprovalContainer} component.
 *
 * @docsCategory ui-components
 */
export interface ToolApprovalContainerProps {
  /** Custom className for the container */
  className?: string;
  /** Custom render function for the approval dialog */
  renderDialog?: (props: {
    request: Parameters<typeof ToolApprovalDialog>[0]['request'];
    onApprove: () => void;
    onReject: (reason?: string) => void;
    isSubmitting: boolean;
    error: Error | null;
  }) => React.ReactNode;
}

/**
 * @description
 * Container component that automatically displays pending tool approval dialogs.
 *
 * Integrates with the {@link useToolApproval} hook from `@hexos/react-core` to monitor pending
 * approval requests and render approval dialogs. Only shows one approval at a time, queuing
 * additional requests until the current one is resolved.
 *
 * The component handles the complete approval workflow: rendering the dialog, submitting the
 * user's decision (approve/reject), and managing loading and error states.
 *
 * Custom dialog rendering is supported via the `renderDialog` prop for white-label customization
 * while preserving the approval state management.
 *
 * Related components: {@link useToolApproval}, {@link ToolApprovalDialog}
 *
 * @example Basic usage
 * ```tsx
 * function App() {
 *   return (
 *     <AgentUIProvider>
 *       <ChatWindow config={config} />
 *       <ToolApprovalContainer />
 *     </AgentUIProvider>
 *   );
 * }
 * ```
 *
 * @example Custom dialog rendering
 * ```tsx
 * <ToolApprovalContainer
 *   renderDialog={({ request, onApprove, onReject, isSubmitting }) => (
 *     <MyCustomDialog
 *       toolName={request.toolName}
 *       args={request.args}
 *       onApprove={onApprove}
 *       onReject={onReject}
 *       loading={isSubmitting}
 *     />
 *   )}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function ToolApprovalContainer({
  className = '',
  renderDialog,
}: ToolApprovalContainerProps): React.ReactElement | null {
  const { pending, approve, reject, isSubmitting, error } = useToolApproval();

  // Only show the first pending request (one at a time)
  const currentRequest = pending[0];

  if (!currentRequest) {
    return null;
  }

  if (renderDialog) {
    return (
      <div className={`hexos-approval-container ${className}`}>
        {renderDialog({
          request: currentRequest,
          onApprove: () => approve(currentRequest.toolCallId),
          onReject: (reason) => reject(currentRequest.toolCallId, reason),
          isSubmitting,
          error,
        })}
      </div>
    );
  }

  return (
    <ToolApprovalDialog
      request={currentRequest}
      onApprove={() => approve(currentRequest.toolCallId)}
      onReject={(reason) => reject(currentRequest.toolCallId, reason)}
      isSubmitting={isSubmitting}
      error={error}
      className={className}
    />
  );
}

/**
 * @description
 * Props for the {@link PendingApprovalBadge} component.
 *
 * @docsCategory ui-components
 */
export interface PendingApprovalBadgeProps {
  className?: string;
  onClick?: () => void;
}

/**
 * @description
 * Badge component showing the count of pending tool approvals.
 *
 * Displays a pill-shaped badge with a pulsing amber indicator and count of pending approval requests.
 * Useful for headers or sidebars to provide persistent visibility of approval queue status.
 *
 * Automatically hides when no approvals are pending. The optional `onClick` handler enables
 * navigation to an approvals view or dialog.
 *
 * @example
 * ```tsx
 * <PendingApprovalBadge onClick={() => setShowApprovals(true)} />
 * ```
 *
 * @docsCategory ui-components
 */
export function PendingApprovalBadge({
  className = '',
  onClick,
}: PendingApprovalBadgeProps): React.ReactElement | null {
  const { pending } = useToolApproval();

  if (pending.length === 0) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={`hexos-pending-approval-badge ${className} ax-inline-flex ax-items-center ax-gap-1.5 ax-px-3 ax-py-1.5 ax-bg-amber-100 ax-text-amber-800 ax-border ax-border-amber-300 ax-rounded-full ax-text-sm ax-font-medium`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <span className="ax-w-2 ax-h-2 ax-bg-amber-500 ax-rounded-full ax-animate-pulse" />
      {pending.length} pending approval{pending.length > 1 ? 's' : ''}
    </Button>
  );
}
