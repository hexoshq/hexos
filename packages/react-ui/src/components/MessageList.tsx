import React, { useRef, useEffect } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import type { AgentMessage, HandoffEvent } from '@hexos/react-core';
import { MessageBubble } from './MessageBubble.js';
import { HandoffIndicator } from './HandoffIndicator.js';

/**
 * @description
 * Props for the {@link MessageList} component.
 *
 * @docsCategory ui-components
 */
export interface MessageListProps {
  messages: AgentMessage[];
  renderMessage?: (message: AgentMessage, index: number, isStreaming: boolean) => React.ReactNode;
  virtualize?: boolean;
  estimatedMessageHeight?: number;
  className?: string;
  showAvatars?: boolean;
  showTimestamps?: boolean;
  showAgentNames?: boolean;
  showReasoning?: boolean;
  autoScroll?: boolean;
  /** Whether the last message is currently streaming */
  isStreaming?: boolean;
  /** Runtime visibility toggle for all tool calls */
  toolCallsVisible?: boolean;
  /** Handoff events to display between messages */
  handoffs?: HandoffEvent[];
  /** Whether to show handoff indicators */
  showHandoffs?: boolean;
  /** Handoff indicator variant */
  handoffVariant?: 'inline' | 'card';
}

/**
 * @description
 * Scrollable message list component with auto-scroll and handoff display.
 *
 * Renders a chronological list of agent messages using Radix ScrollArea for cross-browser custom scrollbars.
 * Automatically scrolls to the bottom when new messages arrive or during streaming.
 *
 * Supports interspersed {@link HandoffIndicator} components between messages to visualize agent transitions.
 * Handoffs are positioned based on their timestamp relative to message timestamps.
 *
 * The component tracks which handoffs have been rendered to prevent duplicates, showing each handoff
 * before the first message from the target agent that occurs after the handoff timestamp.
 *
 * Related components: {@link MessageBubble}, {@link HandoffIndicator}
 *
 * @example
 * ```tsx
 * <MessageList
 *   messages={messages}
 *   isStreaming={isStreaming}
 *   handoffs={handoffHistory}
 *   showHandoffs
 *   handoffVariant="card"
 *   autoScroll
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function MessageList({
  messages,
  renderMessage,
  virtualize: _virtualize = false,
  estimatedMessageHeight: _estimatedMessageHeight = 80,
  className = '',
  showAvatars = false,
  showTimestamps = false,
  showAgentNames = false,
  showReasoning = true,
  autoScroll = true,
  isStreaming = false,
  toolCallsVisible = true,
  handoffs = [],
  showHandoffs = true,
  handoffVariant = 'inline',
}: MessageListProps): React.ReactElement {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, autoScroll]);

  // Track which handoffs have been rendered
  const renderedHandoffs = new Set<string>();

  return (
    <ScrollArea.Root className={`hexos-message-list ${className}`}>
      <ScrollArea.Viewport className="ax-h-full ax-w-full">
        <div className="ax-flex ax-flex-col ax-gap-3 ax-p-4">
          {messages.length === 0 ? (
            <div className="hexos-message-list-empty">
              No messages yet
            </div>
          ) : (
            messages.map((message, index) => {
              // Get handoffs that should appear before this message
              const handoffsBefore = showHandoffs
                ? handoffs.filter((h) => {
                    // Show handoff before messages from the target agent
                    // that haven't been rendered yet
                    if (renderedHandoffs.has(h.id)) return false;
                    if (message.agentId === h.toAgent && message.createdAt >= h.timestamp) {
                      renderedHandoffs.add(h.id);
                      return true;
                    }
                    return false;
                  })
                : [];

              return (
                <React.Fragment key={message.id}>
                  {/* Render handoffs before this message */}
                  {handoffsBefore.map((handoff) => (
                    <HandoffIndicator
                      key={handoff.id}
                      fromAgent={handoff.fromAgent}
                      toAgent={handoff.toAgent}
                      reason={handoff.reason}
                      timestamp={handoff.timestamp}
                      variant={handoffVariant}
                    />
                  ))}

                  {/* Render the message */}
                  {(() => {
                    // Check if this is the last message and is streaming
                    const isLastMessage = index === messages.length - 1;
                    const messageIsStreaming = isLastMessage && isStreaming;

                    return renderMessage ? (
                      renderMessage(message, index, messageIsStreaming)
                    ) : (
                      <MessageBubble
                        message={message}
                        showAvatar={showAvatars}
                        showTimestamp={showTimestamps}
                        showAgentName={showAgentNames}
                        showReasoning={showReasoning}
                        isStreaming={messageIsStreaming}
                        toolCallsVisible={toolCallsVisible}
                      />
                    );
                  })()}
                </React.Fragment>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar
        orientation="vertical"
        className="ax-flex ax-select-none ax-touch-none ax-p-0.5 ax-transition-colors ax-w-2.5"
      >
        <ScrollArea.Thumb className="ax-flex-1 ax-rounded-full ax-bg-gray-300 hover:ax-bg-gray-400 ax-relative before:ax-content-[''] before:ax-absolute before:ax-top-1/2 before:ax-left-1/2 before:ax--translate-x-1/2 before:ax--translate-y-1/2 before:ax-w-full before:ax-h-full before:ax-min-w-[44px] before:ax-min-h-[44px]" />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
