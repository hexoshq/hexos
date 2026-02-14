import React from 'react';
import type { AgentMessage } from '@hexos/react-core';
import { ToolCallRenderer, type ToolCallRenderProps } from './ToolCallRenderer.js';
import { ReasoningDisplay } from './ReasoningDisplay.js';
import { useDisplayConfig } from '../theme/AgentUIProvider.js';

/**
 * @description
 * Props for the {@link MessageBubble} component.
 *
 * @docsCategory ui-components
 */
export interface MessageBubbleProps {
  message: AgentMessage;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  showAgentName?: boolean;
  showToolCalls?: boolean;
  showReasoning?: boolean;
  /** Whether this message is currently streaming */
  isStreaming?: boolean;
  toolRenderers?: Record<string, React.ComponentType<ToolCallRenderProps>>;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * @description
 * Individual message bubble component for rendering a single agent message.
 *
 * Displays message content with optional avatar, timestamp, agent name, and action buttons.
 * Automatically extracts and renders message parts including reasoning, tool calls, and tool results.
 *
 * The component respects display configuration from {@link useDisplayConfig} to control tool call
 * visibility for white-label applications. If the display config hides all tool information,
 * tool calls are not rendered even if `showToolCalls` is true.
 *
 * Tool results are matched to their corresponding tool calls by `toolCallId` and rendered together
 * in {@link ToolCallRenderer} components.
 *
 * Related components: {@link ToolCallRenderer}, {@link ReasoningDisplay}
 *
 * @example
 * ```tsx
 * <MessageBubble
 *   message={message}
 *   showAvatar
 *   showTimestamp
 *   showReasoning
 *   isStreaming={isLastMessage && isStreaming}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function MessageBubble({
  message,
  showAvatar = false,
  showTimestamp = false,
  showAgentName = false,
  showToolCalls = true,
  showReasoning = true,
  isStreaming = false,
  toolRenderers,
  actions,
  className = '',
}: MessageBubbleProps): React.ReactElement {
  const displayConfig = useDisplayConfig();
  const isUser = message.role === 'user';
  const roleClass = isUser ? 'user' : 'assistant';

  // Determine effective showToolCalls based on both prop and config
  // If display config hides everything (no name, no indicator), effectively hide tool calls
  const configHidesToolCalls = !displayConfig.toolDisplay.showToolName && !displayConfig.toolDisplay.showActivityIndicator;
  const effectiveShowToolCalls = showToolCalls && !configHidesToolCalls;

  // Extract reasoning parts
  const reasoningParts = message.parts?.filter((p) => p.type === 'reasoning') ?? [];

  // Extract tool calls and their results from parts
  const toolCallParts = message.parts?.filter((p) => p.type === 'tool-call') ?? [];
  const toolResultParts = message.parts?.filter((p) => p.type === 'tool-result') ?? [];

  // Create a map of tool results by toolCallId
  const toolResults = new Map<string, unknown>();
  for (const part of toolResultParts) {
    if (part.type === 'tool-result') {
      toolResults.set(part.toolCallId, part.result);
    }
  }

  const avatarLabel = isUser ? 'U' : message.agentId?.[0]?.toUpperCase() ?? 'A';

  const containerClassName = [
    'hexos-message',
    `hexos-message--${roleClass}`,
    showAvatar ? 'hexos-message--with-avatar' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={containerClassName}>
      {showAvatar && (
        <div className="hexos-message__avatar">
          {avatarLabel}
        </div>
      )}

      <div className="hexos-message__content">
        {showAgentName && !isUser && message.agentId && (
          <span className="hexos-message__agent-name">{message.agentId}</span>
        )}

        {showReasoning && reasoningParts.length > 0 && (
          <div className="hexos-message__reasoning">
            {reasoningParts.map((part, index) =>
              part.type === 'reasoning' ? (
                <ReasoningDisplay
                  key={`reasoning-${index}`}
                  content={part.content}
                  isStreaming={isStreaming}
                  defaultCollapsed={!isStreaming}
                />
              ) : null
            )}
          </div>
        )}

        <div className="hexos-message__bubble">
          {message.content}
        </div>

        {effectiveShowToolCalls && toolCallParts.length > 0 && (
          <div className="hexos-message-tool-calls">
            {toolCallParts.map((part) => {
              if (part.type !== 'tool-call') return null;
              const result = toolResults.get(part.toolCallId);
              return (
                <ToolCallRenderer
                  key={part.toolCallId}
                  toolName={part.toolName}
                  args={part.args}
                  result={result}
                  state={part.state}
                  renderers={toolRenderers}
                />
              );
            })}
          </div>
        )}

        {(showTimestamp || actions) && (
          <div className="hexos-message__meta">
            {showTimestamp && (
              <span className="hexos-message__timestamp">
                {message.createdAt.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            )}

            {actions && <div className="hexos-message-actions">{actions}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
