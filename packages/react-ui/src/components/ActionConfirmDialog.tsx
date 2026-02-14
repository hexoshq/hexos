import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../primitives/Button.js';

/**
 * @description
 * Props for the {@link ActionConfirmDialog} component.
 *
 * @docsCategory ui-components
 */
export interface ActionConfirmDialogProps {
  /** Action name */
  actionName: string;
  /** Arguments being passed to the action */
  args: unknown;
  /** Confirmation message to display */
  message: string;
  /** Called when user confirms the action */
  onConfirm: () => void;
  /** Called when user cancels the action */
  onCancel: () => void;
  /** Whether the action is currently being executed */
  isExecuting?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * @description
 * Modal dialog for confirming action execution before proceeding.
 *
 * Uses Radix UI Dialog for accessibility including focus trap, Escape key handling, and proper
 * ARIA attributes. Displays a confirmation message, action name, and JSON-formatted arguments.
 *
 * The dialog prevents outside clicks to ensure explicit user decision. Escape key triggers
 * cancellation. During execution, interactive elements are disabled and the confirm button
 * shows "Executing..." feedback.
 *
 * This component is part of the action confirmation workflow for human-in-the-loop validations.
 *
 * @example
 * ```tsx
 * <ActionConfirmDialog
 *   actionName="delete_item"
 *   args={{ id: '123' }}
 *   message="Are you sure you want to delete this item?"
 *   onConfirm={() => executeAction()}
 *   onCancel={() => cancelAction()}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function ActionConfirmDialog({
  actionName,
  args,
  message,
  onConfirm,
  onCancel,
  isExecuting = false,
  className = '',
}: ActionConfirmDialogProps): React.ReactElement {
  return (
    <Dialog.Root open={true}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={`hexos-action-confirm-dialog ${className} ax-fixed ax-inset-0 ax-bg-black/50 ax-z-50`}
        />
        <Dialog.Content
          onEscapeKeyDown={() => onCancel()}
          onInteractOutside={(e) => e.preventDefault()}
          className="ax-fixed ax-z-50 ax-top-1/2 ax-left-1/2 ax--translate-x-1/2 ax--translate-y-1/2 ax-bg-white ax-rounded-xl ax-max-w-md ax-w-[90%] ax-p-6"
          style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
        >
          {/* Header */}
          <div className="ax-mb-4">
            <Dialog.Title className="ax-m-0 ax-text-lg ax-font-semibold ax-text-gray-900">
              Confirm Action
            </Dialog.Title>
          </div>

          {/* Message */}
          <Dialog.Description className="ax-mb-4 ax-text-gray-700 ax-leading-relaxed" style={{ fontSize: '0.9375rem' }}>
            {message}
          </Dialog.Description>

          {/* Action info */}
          <div className="ax-bg-gray-50 ax-rounded-lg ax-p-3 ax-mb-5">
            <div className="ax-flex ax-items-center ax-gap-2 ax-mb-2">
              <span className="ax-font-mono ax-font-semibold ax-text-sm ax-text-gray-800">
                {actionName}
              </span>
            </div>

            {args !== null &&
            args !== undefined &&
            typeof args === 'object' &&
            Object.keys(args as Record<string, unknown>).length > 0 ? (
              <div>
                <div className="ax-text-xs ax-text-gray-500 ax-mb-1">
                  Arguments
                </div>
                <pre className="ax-m-0 ax-p-1.5 ax-bg-white ax-rounded ax-border ax-border-gray-200 ax-overflow-auto ax-text-xs ax-font-mono ax-max-h-[120px]">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>

          {/* Actions */}
          <div className="ax-flex ax-gap-3 ax-justify-end">
            <Button
              type="button"
              onClick={onCancel}
              disabled={isExecuting}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onConfirm}
              disabled={isExecuting}
            >
              {isExecuting ? 'Executing...' : 'Confirm'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * @description
 * Props for the {@link ActionConfirmContainer} component.
 *
 * @docsCategory ui-components
 */
export interface ActionConfirmContainerProps {
  /** Custom className */
  className?: string;
  /** Custom render function for the confirmation dialog */
  renderDialog?: (props: {
    actionName: string;
    args: unknown;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isExecuting: boolean;
  }) => React.ReactNode;
}

/**
 * @description
 * Container component that displays pending action confirmation dialogs.
 *
 * Monitors the `pendingActionConfirmationsAtom` from `@hexos/react-core` and renders confirmation
 * dialogs for actions requiring user approval. Only shows one confirmation at a time.
 *
 * This is a placeholder implementation. Full integration requires connecting to the
 * `pendingActionConfirmationsAtom` and handling the resolution callbacks.
 *
 * Custom dialog rendering is supported via the `renderDialog` prop for white-label customization.
 *
 * @example
 * ```tsx
 * <ActionConfirmContainer />
 * ```
 *
 * @docsCategory ui-components
 */
export function ActionConfirmContainer({
  className = '',
  renderDialog,
}: ActionConfirmContainerProps): React.ReactElement | null {
  // This component would need access to pendingActionConfirmationsAtom
  // For now, we'll provide just the UI component
  // The actual integration with the atom would be done in the app

  // Placeholder - in real usage, this would read from pendingActionConfirmationsAtom
  const pendingConfirmations: Array<{
    id: string;
    actionName: string;
    args: unknown;
    message: string;
    resolve: (confirmed: boolean) => void;
  }> = [];

  const currentConfirmation = pendingConfirmations[0];

  if (!currentConfirmation) {
    return null;
  }

  if (renderDialog) {
    return (
      <div className={`hexos-action-confirm-container ${className}`}>
        {renderDialog({
          actionName: currentConfirmation.actionName,
          args: currentConfirmation.args,
          message: currentConfirmation.message,
          onConfirm: () => currentConfirmation.resolve(true),
          onCancel: () => currentConfirmation.resolve(false),
          isExecuting: false,
        })}
      </div>
    );
  }

  return (
    <ActionConfirmDialog
      actionName={currentConfirmation.actionName}
      args={currentConfirmation.args}
      message={currentConfirmation.message}
      onConfirm={() => currentConfirmation.resolve(true)}
      onCancel={() => currentConfirmation.resolve(false)}
      className={className}
    />
  );
}
