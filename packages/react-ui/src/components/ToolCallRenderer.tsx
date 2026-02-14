import React from 'react';
import type { ToolCallState } from '@hexos/react-core';
import { useDisplayConfig, type ResolvedToolDisplayOptions } from '../theme/AgentUIProvider.js';

/**
 * @description
 * Props passed to custom tool call renderers.
 *
 * Custom renderers receive tool arguments, execution result, state, and display options
 * to implement domain-specific visualizations.
 *
 * @docsCategory ui-components
 */
export interface ToolCallRenderProps {
  args: unknown;
  result?: unknown;
  state: ToolCallState;
  /** Display options for white-label configuration */
  displayOptions?: ResolvedToolDisplayOptions;
}

/**
 * @description
 * Props for the {@link ToolCallRenderer} component.
 *
 * @docsCategory ui-components
 */
export interface ToolCallRendererProps {
  toolName: string;
  args: unknown;
  result?: unknown;
  state: ToolCallState;
  renderers?: Record<string, React.ComponentType<ToolCallRenderProps>>;
  className?: string;
}

/**
 * @description
 * Renders tool call execution with arguments, state, and results.
 *
 * Provides two rendering modes based on display configuration:
 * - Full mode: Shows tool name, state badge, JSON arguments, and results in expandable sections
 * - Minimal mode: Shows only tool name with subtle activity indicator for active executions
 * - Hidden mode: Returns null when both name and indicator are disabled
 *
 * Supports custom renderers via the `renderers` prop, which maps tool names to React components.
 * Custom renderers receive {@link ToolCallRenderProps} including display options for white-label customization.
 *
 * The component respects display configuration from {@link useDisplayConfig}, allowing fine-grained
 * control over which elements are visible (name, state, arguments, result, activity indicator).
 *
 * State visualization uses color-coded badges: pending (yellow), executing (blue), awaiting-approval (orange),
 * completed (green), failed (red).
 *
 * Related types: {@link ToolCallState}, display config
 *
 * @example
 * ```tsx
 * <ToolCallRenderer
 *   toolName="web_search"
 *   args={{ query: "weather" }}
 *   result={{ temperature: 72 }}
 *   state="completed"
 *   renderers={{
 *     web_search: CustomSearchRenderer
 *   }}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function ToolCallRenderer({
  toolName,
  args,
  result,
  state,
  renderers,
  className = '',
}: ToolCallRendererProps): React.ReactElement | null {
  const displayConfig = useDisplayConfig();
  const displayOptions = displayConfig.toolDisplay;

  // Check for custom renderer - pass display options
  const CustomRenderer = renderers?.[toolName];
  if (CustomRenderer) {
    return (
      <div className={`hexos-tool-call ${className}`}>
        <CustomRenderer args={args} result={result} state={state} displayOptions={displayOptions} />
      </div>
    );
  }

  // If completely hidden (no name and no activity indicator), render nothing
  if (!displayOptions.showToolName && !displayOptions.showActivityIndicator) {
    return null;
  }

  const stateColors: Record<ToolCallState, string> = {
    pending: '#fbbf24',
    executing: '#3b82f6',
    'awaiting-approval': '#f59e0b',
    completed: '#10b981',
    failed: '#ef4444',
  };

  const stateLabels: Record<ToolCallState, string> = {
    pending: 'Pending',
    executing: 'Executing...',
    'awaiting-approval': 'Awaiting Approval',
    completed: 'Completed',
    failed: 'Failed',
  };

  // Minimal mode: just tool name with optional activity indicator
  const isMinimalMode = !displayOptions.showToolState && !displayOptions.showToolArgs && !displayOptions.showToolResult;
  if (isMinimalMode) {
    const isActive = state === 'pending' || state === 'executing';
    return (
      <div
        className={`hexos-tool-call hexos-tool-call--minimal ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.25rem 0.5rem',
          fontSize: '0.875rem',
          color: '#6b7280',
        }}
      >
        {displayOptions.showToolName && <span>{toolName}</span>}
        {displayOptions.showActivityIndicator && isActive && (
          <span
            className="hexos-tool-call__activity-dot"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#3b82f6',
              animation: 'hexos-pulse 1.5s ease-in-out infinite',
            }}
          />
        )}
      </div>
    );
  }

  // Full mode with conditional sections
  return (
    <div
      className={`hexos-tool-call ${className}`}
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '0.5rem',
        overflow: 'hidden',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
        fontSize: '0.875rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        {displayOptions.showToolName && (
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 500,
            }}
          >
            {toolName}
          </span>
        )}
        {displayOptions.showToolState && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              color: stateColors[state],
            }}
          >
            <span
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                backgroundColor: stateColors[state],
              }}
            />
            {stateLabels[state]}
          </span>
        )}
      </div>

      {/* Arguments */}
      {displayOptions.showToolArgs && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
            borderBottom: result !== undefined && displayOptions.showToolResult ? '1px solid #e5e7eb' : undefined,
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              marginBottom: '0.25rem',
            }}
          >
            Arguments
          </div>
          <pre
            style={{
              margin: 0,
              padding: '0.5rem',
              backgroundColor: '#f9fafb',
              borderRadius: '0.25rem',
              overflow: 'auto',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
            }}
          >
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}

      {/* Result */}
      {displayOptions.showToolResult && result !== undefined && (
        <div
          style={{
            padding: '0.5rem 0.75rem',
          }}
        >
          <div
            style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              marginBottom: '0.25rem',
            }}
          >
            Result
          </div>
          <pre
            style={{
              margin: 0,
              padding: '0.5rem',
              backgroundColor: state === 'failed' ? '#fef2f2' : '#f0fdf4',
              borderRadius: '0.25rem',
              overflow: 'auto',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: state === 'failed' ? '#dc2626' : '#166534',
            }}
          >
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
