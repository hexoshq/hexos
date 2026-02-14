import React from 'react';

/**
 * @description
 * Props for the {@link StreamingIndicator} component.
 *
 * @docsCategory ui-components
 */
export interface StreamingIndicatorProps {
  agentName?: string;
  className?: string;
}

/**
 * @description
 * Animated typing indicator shown during agent response streaming.
 *
 * Displays a three-dot animation with optional agent name label to provide visual feedback
 * that the agent is actively generating a response.
 *
 * The animation is CSS-based and automatically loops. The label text adjusts based on whether
 * an agent name is provided: "{agentName} is typing..." or simply "Typing...".
 *
 * @example
 * ```tsx
 * {isStreaming && <StreamingIndicator agentName={activeAgent} />}
 * ```
 *
 * @docsCategory ui-components
 */
export function StreamingIndicator({
  agentName,
  className = '',
}: StreamingIndicatorProps): React.ReactElement {
  const label = agentName ? `${agentName} is typing...` : 'Typing...';

  return (
    <div className={`hexos-streaming-indicator ${className}`}>
      <div className="hexos-streaming-indicator__dots">
        {[0, 1, 2].map((dotIndex) => (
          <span key={dotIndex} className="hexos-streaming-indicator__dot" />
        ))}
      </div>
      <span className="hexos-streaming-indicator__text">{label}</span>
    </div>
  );
}
