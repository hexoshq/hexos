import React, { useState } from 'react';
import { useAgent, type AgentConfig, type AgentMessage } from '@hexos/react-core';
import { MessageList } from './MessageList.js';
import { InputComposer } from './InputComposer.js';
import { StreamingIndicator } from './StreamingIndicator.js';
import { AgentStatusBar, type AgentInfo } from './AgentSwitcher.js';
import { QuickReplies } from './QuickReplies.js';

/**
 * @description
 * Props for the {@link ChatWindow} component.
 *
 * @docsCategory ui-components
 */
export interface ChatWindowProps {
  /** Agent configuration (required if not using AgentProvider) */
  config?: AgentConfig;
  /** Additional class name */
  className?: string;
  /** Header component */
  header?: React.ReactNode;
  /** Empty state component */
  emptyState?: React.ReactNode;
  /** Custom message renderer */
  renderMessage?: (message: AgentMessage, index: number, isStreaming: boolean) => React.ReactNode;
  /** Show reasoning display for agent thinking */
  showReasoning?: boolean;
  /** Custom input component */
  renderInput?: (props: {
    onSubmit: (content: string) => void;
    disabled: boolean;
  }) => React.ReactNode;
  /** Show agent indicators for multi-agent */
  showAgentBadges?: boolean;
  /** Enable message actions (edit, copy, regenerate) */
  enableMessageActions?: boolean;
  /** Styling variant */
  variant?: 'default' | 'floating' | 'fullscreen' | 'sidebar';
  /** Placeholder text for input */
  placeholder?: string;
  /** Show handoff indicators between messages */
  showHandoffs?: boolean;
  /** Handoff indicator variant */
  handoffVariant?: 'inline' | 'card';
  /** Show agent status bar in header */
  showAgentStatus?: boolean;
  /** List of available agents (for status bar) */
  agents?: AgentInfo[];
  /** Suggested prompts shown before the first message */
  suggestions?: string[];
  /** Optional heading above suggestion chips */
  suggestionsTitle?: string;
  /** Show a toggle button for users to show/hide all tool calls at runtime */
  showToolCallsControl?: boolean;
}

/**
 * @description
 * Full-featured chat window component for agent conversations.
 *
 * Orchestrates the complete chat interface including message history, input composer, streaming indicators,
 * agent status display, and handoff transitions. Connects to the agent runtime via the {@link useAgent} hook
 * from `@hexos/react-core`.
 *
 * The component manages error display, empty states, and suggestion chips for initial user engagement.
 * Supports both standalone usage with a direct {@link AgentConfig} or integration with an AgentProvider.
 *
 * Multi-agent features include agent badges, status bars, and handoff indicators. The streaming state
 * automatically disables input and shows visual feedback.
 *
 * Related components: {@link MessageList}, {@link InputComposer}, {@link StreamingIndicator}, {@link AgentStatusBar}
 *
 * @example
 * ```tsx
 * <ChatWindow
 *   config={{ endpoint: '/api/agent/chat' }}
 *   showReasoning
 *   showAgentBadges
 *   suggestions={['Hello', 'Help me with...']}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function ChatWindow({
  config,
  className = '',
  header,
  emptyState,
  renderMessage,
  showReasoning = true,
  renderInput,
  showAgentBadges = false,
  enableMessageActions: _enableMessageActions = false,
  variant = 'default',
  placeholder,
  showHandoffs = true,
  handoffVariant = 'inline',
  showAgentStatus = false,
  agents = [],
  suggestions = [],
  suggestionsTitle,
  showToolCallsControl = false,
}: ChatWindowProps): React.ReactElement {
  // Use the hook if config is provided, otherwise expect AgentProvider
  const defaultConfig: AgentConfig = config ?? {
    endpoint: '/api/agent/chat',
  };

  const { messages, sendMessage, isStreaming, activeAgent, error, clearError, handoffHistory } =
    useAgent(defaultConfig);

  // Feature: runtime tool calls visibility toggle
  const [toolCallsVisible, setToolCallsVisible] = useState<boolean>(true);

  // Find the active agent info
  const activeAgentInfo =
    agents.find((a) => a.id === activeAgent) ??
    (activeAgent ? { id: activeAgent, name: activeAgent } : null);

  const handleSubmit = (content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;
    sendMessage(trimmedContent);
  };

  const variantClass = `hexos-variant-${variant}`;
  const showSuggestions = suggestions.length > 0 && messages.length === 0;

  return (
    <div className={`hexos-chat-window ${variantClass} ${className}`}>
      {/* Agent Status Bar */}
      {showAgentStatus && activeAgentInfo && (
        <AgentStatusBar activeAgent={activeAgentInfo} isStreaming={isStreaming} />
      )}

      {/* Header */}
      {header && (
        <div
          className="hexos-chat-header"
        >
          {header}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          className="hexos-chat-error"
        >
          <span>{error.message}</span>
          <button
            type="button"
            onClick={clearError}
            className="hexos-chat-error__dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Messages */}
      {messages.length === 0 && emptyState ? (
        <div
          className="hexos-chat-empty"
        >
          {emptyState}
        </div>
      ) : (
        <MessageList
          messages={messages}
          renderMessage={renderMessage}
          showAvatars={showAgentBadges}
          showAgentNames={showAgentBadges}
          showReasoning={showReasoning}
          isStreaming={isStreaming}
          handoffs={handoffHistory}
          showHandoffs={showHandoffs}
          handoffVariant={handoffVariant}
          toolCallsVisible={toolCallsVisible}
        />
      )}

      {/* Streaming indicator */}
      {isStreaming && (
        <StreamingIndicator agentName={showAgentBadges ? (activeAgent ?? undefined) : undefined} />
      )}

      {showSuggestions && (
        <QuickReplies suggestions={suggestions} title={suggestionsTitle} onSelect={handleSubmit} />
      )}

      {/* Tool calls visibility control */}
      {showToolCallsControl && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '0.25rem 0.75rem',
            borderTop: '1px solid #f3f4f6',
          }}
        >
          <button
            type="button"
            onClick={() => setToolCallsVisible((v) => !v)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.25rem 0.625rem',
              fontSize: '0.75rem',
              color: toolCallsVisible ? '#3b82f6' : '#9ca3af',
              backgroundColor: 'transparent',
              border: '1px solid',
              borderColor: toolCallsVisible ? '#bfdbfe' : '#e5e7eb',
              borderRadius: '9999px',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              lineHeight: 1,
            }}
            title={toolCallsVisible ? 'Hide tool calls' : 'Show tool calls'}
          >
            <span aria-hidden="true" style={{ fontSize: '0.875rem' }}>
              {toolCallsVisible ? '⚙' : '○'}
            </span>
            <span>{toolCallsVisible ? 'Tool calls on' : 'Tool calls off'}</span>
          </button>
        </div>
      )}

      {/* Input */}
      {renderInput ? (
        renderInput({
          onSubmit: handleSubmit,
          disabled: isStreaming,
        })
      ) : (
        <InputComposer onSubmit={handleSubmit} disabled={isStreaming} placeholder={placeholder} />
      )}
    </div>
  );
}
