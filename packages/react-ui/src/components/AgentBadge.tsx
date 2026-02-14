import React from 'react';

/**
 * @description
 * Predefined color schemes for agent identification.
 *
 * Maps common agent role identifiers to consistent color palettes including background,
 * text, border, and icon colors. Used by {@link getAgentColors} and {@link AgentBadge}.
 *
 * @docsCategory ui-components
 */
export const AGENT_COLORS: Record<
  string,
  { bg: string; text: string; border: string; icon: string }
> = {
  main: { bg: '#eff6ff', text: '#1d4ed8', border: '#3b82f6', icon: '#3b82f6' },
  code: { bg: '#f0fdf4', text: '#166534', border: '#22c55e', icon: '#22c55e' },
  research: { bg: '#fefce8', text: '#a16207', border: '#eab308', icon: '#eab308' },
  assistant: { bg: '#f5f3ff', text: '#6d28d9', border: '#8b5cf6', icon: '#8b5cf6' },
  analyst: { bg: '#fff1f2', text: '#be123c', border: '#f43f5e', icon: '#f43f5e' },
  writer: { bg: '#ecfeff', text: '#0e7490', border: '#06b6d4', icon: '#06b6d4' },
  default: { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb', icon: '#9ca3af' },
};

/**
 * @description
 * Retrieves the color scheme for a given agent identifier.
 *
 * Performs case-insensitive lookup in {@link AGENT_COLORS}. Returns the default
 * color scheme if the agent ID is not found in the predefined set.
 *
 * @param agentId - Agent identifier string
 * @returns Color scheme object with bg, text, border, and icon properties
 *
 * @docsCategory ui-components
 */
export function getAgentColors(agentId: string): (typeof AGENT_COLORS)['default'] {
  return AGENT_COLORS[agentId.toLowerCase()] ?? AGENT_COLORS.default;
}

/**
 * @description
 * Props for the {@link AgentBadge} component.
 *
 * @docsCategory ui-components
 */
export interface AgentBadgeProps {
  agentId: string;
  agentName?: string;
  avatarUrl?: string;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { padding: '0.125rem 0.375rem', fontSize: '0.625rem', iconSize: '0.75rem', gap: '0.25rem' },
  md: { padding: '0.25rem 0.5rem', fontSize: '0.75rem', iconSize: '1rem', gap: '0.375rem' },
  lg: { padding: '0.375rem 0.75rem', fontSize: '0.875rem', iconSize: '1.25rem', gap: '0.5rem' },
};

/**
 * @description
 * Badge component displaying agent identity with color-coded styling.
 *
 * Renders a pill-shaped badge with agent avatar/initial and name, using colors from {@link AGENT_COLORS}
 * for visual distinction. Supports three size presets (sm, md, lg) and active/inactive states.
 *
 * When `isActive` is true, applies the agent's brand colors; otherwise uses neutral gray styling.
 * The optional pulse animation (via `showPulse`) provides real-time feedback during agent activity.
 *
 * Avatar display prioritizes `avatarUrl` if provided, otherwise renders the first character of the
 * agent name as a circular initial badge.
 *
 * Used by {@link AgentSwitcher} for multi-agent conversations to indicate which agent is responding.
 *
 * @example
 * ```tsx
 * <AgentBadge
 *   agentId="code"
 *   agentName="Code Assistant"
 *   isActive
 *   showPulse={isStreaming}
 *   size="md"
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function AgentBadge({
  agentId,
  agentName,
  avatarUrl,
  isActive = false,
  size = 'md',
  showPulse = false,
  className = '',
}: AgentBadgeProps): React.ReactElement {
  const displayName = agentName ?? agentId;
  const colors = getAgentColors(agentId);
  const sizeStyles = sizeConfig[size];

  return (
    <div
      className={`hexos-agent-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeStyles.gap,
        padding: sizeStyles.padding,
        backgroundColor: isActive ? colors.bg : '#f9fafb',
        border: `1px solid ${isActive ? colors.border : '#e5e7eb'}`,
        borderRadius: '9999px',
        fontSize: sizeStyles.fontSize,
        color: isActive ? colors.text : '#6b7280',
        transition: 'all 0.2s ease-in-out',
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          style={{
            width: sizeStyles.iconSize,
            height: sizeStyles.iconSize,
            borderRadius: '50%',
          }}
        />
      ) : (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: sizeStyles.iconSize,
            height: sizeStyles.iconSize,
            borderRadius: '50%',
            backgroundColor: isActive ? colors.icon : '#9ca3af',
            color: 'white',
            fontSize: `calc(${sizeStyles.iconSize} * 0.6)`,
            fontWeight: 'bold',
          }}
        >
          {displayName[0]?.toUpperCase()}
        </span>
      )}
      <span style={{ fontWeight: 500 }}>{displayName}</span>
      {(isActive || showPulse) && (
        <span
          className="hexos-pulse"
          style={{
            width: '0.5rem',
            height: '0.5rem',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            animation: showPulse ? 'hexos-pulse 2s infinite' : undefined,
          }}
        />
      )}
      <style>{`
        @keyframes hexos-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
