import React from 'react';
import { AgentBadge, getAgentColors } from './AgentBadge.js';

/**
 * @description
 * Agent information structure for switcher and status components.
 *
 * @docsCategory ui-components
 */
export interface AgentInfo {
  id: string;
  name?: string;
  description?: string;
  avatarUrl?: string;
}

/**
 * @description
 * Props for the {@link AgentSwitcher} component.
 *
 * @docsCategory ui-components
 */
export interface AgentSwitcherProps {
  /** List of available agents */
  agents: AgentInfo[];
  /** Currently active agent ID */
  activeAgentId: string | null;
  /** Whether an agent is currently streaming */
  isStreaming?: boolean;
  /** Callback when an agent is selected (for manual switching if enabled) */
  onAgentSelect?: (agentId: string) => void;
  /** Whether to allow manual agent selection */
  allowManualSwitch?: boolean;
  /** Display variant */
  variant?: 'compact' | 'expanded' | 'dropdown';
  /** Additional class name */
  className?: string;
}

/**
 * @description
 * Component for displaying and optionally switching between available agents.
 *
 * Provides three display variants:
 * - Compact: Single {@link AgentBadge} with "+N more" counter
 * - Expanded: Grid of agent buttons with circular avatars and names
 * - Dropdown: Single large badge (dropdown functionality to be implemented)
 *
 * When `allowManualSwitch` is true and `onAgentSelect` is provided, users can click agent buttons
 * to manually trigger agent switching. Manual switching is disabled during streaming.
 *
 * The expanded variant highlights the active agent with brand colors and shows a pulsing indicator
 * during streaming. Inactive agents are dimmed when streaming is active.
 *
 * Related components: {@link AgentBadge}
 *
 * @example
 * ```tsx
 * <AgentSwitcher
 *   agents={[
 *     { id: 'main', name: 'Main Assistant' },
 *     { id: 'code', name: 'Code Helper' }
 *   ]}
 *   activeAgentId="main"
 *   variant="expanded"
 *   isStreaming={isStreaming}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function AgentSwitcher({
  agents,
  activeAgentId,
  isStreaming = false,
  onAgentSelect,
  allowManualSwitch = false,
  variant = 'compact',
  className = '',
}: AgentSwitcherProps): React.ReactElement {
  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? agents[0];

  if (variant === 'expanded') {
    return (
      <div
        className={`hexos-agent-switcher hexos-agent-switcher-expanded ${className}`}
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#f9fafb',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
        }}
      >
        {agents.map((agent) => {
          const isActive = agent.id === activeAgentId;
          const colors = getAgentColors(agent.id);

          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => allowManualSwitch && onAgentSelect?.(agent.id)}
              disabled={!allowManualSwitch || isStreaming}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: isActive ? colors.bg : 'transparent',
                border: `2px solid ${isActive ? colors.border : 'transparent'}`,
                borderRadius: '0.5rem',
                cursor: allowManualSwitch && !isStreaming ? 'pointer' : 'default',
                opacity: isStreaming && !isActive ? 0.5 : 1,
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <div
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  backgroundColor: colors.icon,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                }}
              >
                {(agent.name ?? agent.id)[0]?.toUpperCase()}
              </div>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? colors.text : '#6b7280',
                }}
              >
                {agent.name ?? agent.id}
              </span>
              {isActive && isStreaming && (
                <span
                  style={{
                    width: '0.375rem',
                    height: '0.375rem',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    animation: 'hexos-pulse 1.5s ease-in-out infinite',
                  }}
                />
              )}
            </button>
          );
        })}
        <style>{`
          @keyframes hexos-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.3); }
          }
        `}</style>
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div
        className={`hexos-agent-switcher hexos-agent-switcher-dropdown ${className}`}
        style={{ position: 'relative' }}
      >
        <AgentBadge
          agentId={activeAgent?.id ?? 'unknown'}
          agentName={activeAgent?.name}
          isActive
          showPulse={isStreaming}
          size="lg"
        />
      </div>
    );
  }

  // Compact variant (default)
  return (
    <div
      className={`hexos-agent-switcher hexos-agent-switcher-compact ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <AgentBadge
        agentId={activeAgent?.id ?? 'unknown'}
        agentName={activeAgent?.name}
        isActive
        showPulse={isStreaming}
      />
      {agents.length > 1 && (
        <span
          style={{
            fontSize: '0.6875rem',
            color: '#9ca3af',
          }}
        >
          +{agents.length - 1} more
        </span>
      )}
    </div>
  );
}

/**
 * @description
 * Props for the {@link AgentStatusBar} component.
 *
 * @docsCategory ui-components
 */
export interface AgentStatusBarProps {
  /** Currently active agent */
  activeAgent: AgentInfo | null;
  /** Whether streaming is in progress */
  isStreaming?: boolean;
  /** Status message to display */
  statusMessage?: string;
  /** Additional class name */
  className?: string;
}

/**
 * @description
 * Status bar component showing the current agent and streaming state.
 *
 * Renders a horizontal bar with a status indicator, agent name, and optional description or
 * status message. The background color adapts to the active agent's color scheme.
 *
 * The status indicator (colored dot) pulses with animation during streaming (green) and shows
 * the agent's brand color when idle. A "typing..." label appears next to the agent name during
 * streaming activity.
 *
 * Useful for headers or footers in chat interfaces to provide persistent visibility of the
 * active agent and its current state.
 *
 * @example
 * ```tsx
 * <AgentStatusBar
 *   activeAgent={{ id: 'code', name: 'Code Assistant', description: 'Helps with programming' }}
 *   isStreaming={isStreaming}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function AgentStatusBar({
  activeAgent,
  isStreaming = false,
  statusMessage,
  className = '',
}: AgentStatusBarProps): React.ReactElement {
  const colors = activeAgent ? getAgentColors(activeAgent.id) : getAgentColors('default');

  return (
    <div
      className={`hexos-agent-status-bar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 1rem',
        backgroundColor: colors.bg,
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      {/* Status indicator */}
      <div
        style={{
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: '50%',
          backgroundColor: isStreaming ? '#10b981' : colors.icon,
          animation: isStreaming ? 'hexos-pulse 1.5s ease-in-out infinite' : undefined,
        }}
      />

      {/* Agent info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: '0.875rem',
              color: colors.text,
            }}
          >
            {activeAgent?.name ?? activeAgent?.id ?? 'No agent'}
          </span>
          {isStreaming && (
            <span
              style={{
                fontSize: '0.75rem',
                color: '#10b981',
              }}
            >
              typing...
            </span>
          )}
        </div>
        {(statusMessage || activeAgent?.description) && (
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              color: '#6b7280',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {statusMessage ?? activeAgent?.description}
          </p>
        )}
      </div>

      <style>{`
        @keyframes hexos-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
