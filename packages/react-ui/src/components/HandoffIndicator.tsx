import React from 'react';
import { getAgentColors } from './AgentBadge.js';

/**
 * @description
 * Props for the {@link HandoffIndicator} component.
 *
 * @docsCategory ui-components
 */
export interface HandoffIndicatorProps {
  fromAgent: string;
  toAgent: string;
  fromAgentName?: string;
  toAgentName?: string;
  reason?: string;
  timestamp?: Date;
  animated?: boolean;
  variant?: 'inline' | 'card';
  className?: string;
}

/**
 * @description
 * Visual indicator for agent handoff transitions in multi-agent conversations.
 *
 * Displays a transition when one agent transfers control to another, showing the source agent,
 * target agent, and optional handoff reason. Supports two display variants:
 *
 * - Inline: Compact pill-shaped indicator with agent dots and arrow, suitable for inline placement
 * - Card: Expanded card layout with agent avatars, animated arrow, reason quote, and timestamp
 *
 * Both variants use {@link getAgentColors} for consistent color-coded agent identification.
 * The animated arrow and pulse effects provide visual feedback that draws attention to the transition.
 *
 * Related types: {@link HandoffEvent} from `@hexos/react-core`
 *
 * @example Inline variant
 * ```tsx
 * <HandoffIndicator
 *   fromAgent="main"
 *   toAgent="code"
 *   variant="inline"
 *   animated
 * />
 * ```
 *
 * @example Card variant with reason
 * ```tsx
 * <HandoffIndicator
 *   fromAgent="main"
 *   fromAgentName="Main Assistant"
 *   toAgent="code"
 *   toAgentName="Code Helper"
 *   reason="User needs help with a coding task"
 *   timestamp={new Date()}
 *   variant="card"
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function HandoffIndicator({
  fromAgent,
  toAgent,
  fromAgentName,
  toAgentName,
  reason,
  timestamp,
  animated = true,
  variant = 'inline',
  className = '',
}: HandoffIndicatorProps): React.ReactElement {
  const fromColors = getAgentColors(fromAgent);
  const toColors = getAgentColors(toAgent);
  const fromDisplay = fromAgentName ?? fromAgent;
  const toDisplay = toAgentName ?? toAgent;

  if (variant === 'card') {
    return (
      <div
        className={`hexos-handoff-indicator hexos-handoff-card ${className}`}
        style={{
          margin: '1rem 0',
          padding: '1rem',
          backgroundColor: '#f8fafc',
          borderRadius: '0.75rem',
          border: '1px solid #e2e8f0',
          animation: animated ? 'hexos-handoff-fade-in 0.3s ease-out' : undefined,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            marginBottom: reason ? '0.75rem' : 0,
          }}
        >
          {/* From Agent */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AgentAvatar agentId={fromAgent} name={fromDisplay} colors={fromColors} />
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{fromDisplay}</span>
          </div>

          {/* Arrow Animation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              color: '#94a3b8',
            }}
          >
            <HandoffArrow animated={animated} />
          </div>

          {/* To Agent */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AgentAvatar agentId={toAgent} name={toDisplay} colors={toColors} highlight />
            <span style={{ fontSize: '0.75rem', color: toColors.text, fontWeight: 500 }}>
              {toDisplay}
            </span>
          </div>
        </div>

        {reason && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.8125rem',
              color: '#64748b',
              fontStyle: 'italic',
              padding: '0.5rem 1rem',
              backgroundColor: '#f1f5f9',
              borderRadius: '0.5rem',
            }}
          >
            "{reason}"
          </div>
        )}

        {timestamp && (
          <div
            style={{
              textAlign: 'center',
              fontSize: '0.6875rem',
              color: '#94a3b8',
              marginTop: '0.5rem',
            }}
          >
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        <style>{handoffStyles}</style>
      </div>
    );
  }

  // Inline variant (default)
  return (
    <div
      className={`hexos-handoff-indicator ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        padding: '0.5rem 1rem',
        margin: '0.5rem 0',
        backgroundColor: '#f8fafc',
        borderRadius: '9999px',
        border: '1px dashed #cbd5e1',
        fontSize: '0.8125rem',
        color: '#64748b',
        animation: animated ? 'hexos-handoff-fade-in 0.3s ease-out' : undefined,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: fromColors.text,
        }}
      >
        <AgentDot color={fromColors.icon} />
        <strong>{fromDisplay}</strong>
      </span>

      <span style={{ display: 'flex', alignItems: 'center' }}>
        <HandoffArrow animated={animated} size="sm" />
      </span>

      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: toColors.text,
        }}
      >
        <AgentDot color={toColors.icon} pulse={animated} />
        <strong>{toDisplay}</strong>
      </span>

      <style>{handoffStyles}</style>
    </div>
  );
}

/**
 * @description
 * Props for internal AgentAvatar component.
 *
 * @docsCategory ui-components
 */
interface AgentAvatarProps {
  agentId: string;
  name: string;
  colors: { bg: string; text: string; border: string; icon: string };
  highlight?: boolean;
}

/**
 * @description
 * Internal component rendering circular agent avatar for card variant.
 *
 * @docsCategory ui-components
 */
function AgentAvatar({ name, colors, highlight }: AgentAvatarProps): React.ReactElement {
  return (
    <div
      style={{
        width: '2.5rem',
        height: '2.5rem',
        borderRadius: '50%',
        backgroundColor: colors.bg,
        border: `2px solid ${highlight ? colors.border : '#e2e8f0'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.icon,
        fontWeight: 'bold',
        fontSize: '1rem',
        boxShadow: highlight ? `0 0 0 3px ${colors.bg}` : undefined,
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

/**
 * @description
 * Props for internal AgentDot component.
 *
 * @docsCategory ui-components
 */
interface AgentDotProps {
  color: string;
  pulse?: boolean;
}

/**
 * @description
 * Internal component rendering small colored dot for inline variant.
 *
 * @docsCategory ui-components
 */
function AgentDot({ color, pulse }: AgentDotProps): React.ReactElement {
  return (
    <span
      style={{
        width: '0.5rem',
        height: '0.5rem',
        borderRadius: '50%',
        backgroundColor: color,
        animation: pulse ? 'hexos-dot-pulse 1.5s ease-in-out infinite' : undefined,
      }}
    />
  );
}

/**
 * @description
 * Props for internal HandoffArrow component.
 *
 * @docsCategory ui-components
 */
interface HandoffArrowProps {
  animated?: boolean;
  size?: 'sm' | 'md';
}

/**
 * @description
 * Internal component rendering animated arrow for handoff direction.
 *
 * @docsCategory ui-components
 */
function HandoffArrow({ animated, size = 'md' }: HandoffArrowProps): React.ReactElement {
  const iconSize = size === 'sm' ? 16 : 24;

  return (
    <svg
      width={iconSize}
      height={iconSize}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        animation: animated ? 'hexos-arrow-move 1s ease-in-out infinite' : undefined,
      }}
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const handoffStyles = `
  @keyframes hexos-handoff-fade-in {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes hexos-arrow-move {
    0%, 100% {
      transform: translateX(0);
      opacity: 1;
    }
    50% {
      transform: translateX(4px);
      opacity: 0.6;
    }
  }

  @keyframes hexos-dot-pulse {
    0%, 100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.3);
      opacity: 0.7;
    }
  }
`;
