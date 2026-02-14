import { useCallback, useEffect, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  messagesAtom,
  isStreamingAtom,
  activeAgentAtom,
  errorAtom,
  conversationIdAtom,
  streamingMessageAtom,
  frontendContextAtom,
  addMessageAtom,
  updateMessageAtom,
  clearMessagesAtom,
  handoffHistoryAtom,
  lastHandoffAtom,
  addHandoffAtom,
  clearHandoffsAtom,
  addPendingApprovalAtom,
  pendingToolCallsAtom,
  transportAtom,
  frontendToolsAtom,
  type HandoffEvent,
} from '../atoms/index.js';
import { SSETransport } from '../transport/SSETransport.js';
import type {
  AgentConfig,
  AgentMessage,
  TransportEvent,
  Attachment,
  MessagePart,
  ToolApprovalRequest,
} from '../types.js';

interface ToolCallTracker {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  state: 'pending' | 'executing' | 'completed' | 'failed';
}

/**
 * @description
 * Return type of the {@link useAgent} hook, providing full agent interaction controls and state.
 *
 * Exposes the message history (including the live streaming message), send/edit/regenerate
 * functions, streaming state, active agent info, handoff history, and pending tool approvals.
 *
 * @docsCategory hooks
 */
export interface UseAgentReturn {
  messages: AgentMessage[];
  sendMessage: (content: string, attachments?: Attachment[]) => Promise<void>;
  isStreaming: boolean;
  activeAgent: string | null;
  error: Error | null;
  clearError: () => void;
  reset: () => void;
  stop: () => void;
  regenerate: () => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  conversationId: string | null;
  /** History of agent handoffs in current conversation */
  handoffHistory: HandoffEvent[];
  /** Most recent handoff event */
  lastHandoff: HandoffEvent | null;
  /** Pending tool approvals */
  pendingApprovals: ToolApprovalRequest[];
}

/**
 * @description
 * Primary hook for agent interaction — manages transport, streaming, and state.
 *
 * Initializes an {@link SSETransport} on mount, subscribes to {@link TransportEvent}s,
 * and translates them into Jotai atom updates. Handles the complete message lifecycle:
 *
 * 1. User sends a message via `sendMessage()` — added optimistically to {@link messagesAtom}
 * 2. Transport streams the response — `text-delta` events accumulate in {@link streamingMessageAtom}
 * 3. Tool calls are tracked locally — `tool-call-start/args/result/error` update internal trackers
 * 4. Frontend tools are detected and executed locally via {@link frontendToolsAtom}
 * 5. Approval requests create entries in {@link pendingToolCallsAtom}
 * 6. Agent handoffs update {@link activeAgentAtom} and {@link handoffHistoryAtom}
 * 7. On `text-complete`, the finalized message with all parts is added to {@link messagesAtom}
 *
 * Also provides `stop()`, `reset()`, `regenerate()`, and `editMessage()` controls.
 *
 * Related: {@link AgentConfig} configures the connection, {@link AgentProvider} provides
 * the Jotai scope, {@link ChatWindow} typically consumes this hook's return value.
 *
 * @param config - Agent configuration with endpoint, headers, and options
 * @returns Object with messages, controls, and state — see {@link UseAgentReturn}
 *
 * @docsCategory hooks
 */
export function useAgent(config: AgentConfig): UseAgentReturn {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [isStreaming, setIsStreaming] = useAtom(isStreamingAtom);
  const [activeAgent, setActiveAgent] = useAtom(activeAgentAtom);
  const [error, setError] = useAtom(errorAtom);
  const [conversationId, setConversationId] = useAtom(conversationIdAtom);
  const [streamingMessage, setStreamingMessage] = useAtom(streamingMessageAtom);
  const frontendContext = useAtomValue(frontendContextAtom);
  const addMessage = useSetAtom(addMessageAtom);
  const updateMessage = useSetAtom(updateMessageAtom);
  const clearMessages = useSetAtom(clearMessagesAtom);
  const handoffHistory = useAtomValue(handoffHistoryAtom);
  const lastHandoff = useAtomValue(lastHandoffAtom);
  const addHandoff = useSetAtom(addHandoffAtom);
  const clearHandoffs = useSetAtom(clearHandoffsAtom);
  const addPendingApproval = useSetAtom(addPendingApprovalAtom);
  const pendingApprovals = useAtomValue(pendingToolCallsAtom);
  const setTransport = useSetAtom(transportAtom);
  const frontendTools = useAtomValue(frontendToolsAtom);

  const transportRef = useRef<SSETransport | null>(null);
  const frontendToolsRef = useRef(frontendTools);
  frontendToolsRef.current = frontendTools;
  const configRef = useRef(config);
  const activeAgentRef = useRef(activeAgent);
  const toolCallsRef = useRef<Map<string, ToolCallTracker>>(new Map());
  const currentMessageIdRef = useRef<string | null>(null);
  const streamingMessageRef = useRef(streamingMessage);
  streamingMessageRef.current = streamingMessage;
  configRef.current = config;
  activeAgentRef.current = activeAgent;

  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    setIsStreaming,
    setActiveAgent,
    setStreamingMessage,
    addMessage,
    setError,
    addHandoff,
    addPendingApproval,
  });
  callbacksRef.current = {
    setIsStreaming,
    setActiveAgent,
    setStreamingMessage,
    addMessage,
    setError,
    addHandoff,
    addPendingApproval,
  };

  // Initialize transport
  useEffect(() => {
    const transport = new SSETransport();
    transport.connect(config);
    transportRef.current = transport;
    setTransport(transport);

    // Set initial conversation ID
    if (config.conversationId) {
      setConversationId(config.conversationId);
    } else if (!conversationId) {
      setConversationId(crypto.randomUUID());
    }

    // Set up event listener with stable reference
    const handleEvent = (event: TransportEvent) => {
      const callbacks = callbacksRef.current;

      switch (event.type) {
        case 'message-start':
          callbacks.setIsStreaming(true);
          callbacks.setActiveAgent(event.agentId);
          currentMessageIdRef.current = event.messageId;
          toolCallsRef.current = new Map();
          callbacks.setStreamingMessage({
            id: event.messageId,
            content: '',
            reasoning: '',
            agentId: event.agentId,
          });
          break;

        case 'text-delta':
          callbacks.setStreamingMessage((prev) => {
            if (!prev || prev.id !== event.messageId) return prev;
            return { ...prev, content: prev.content + event.delta };
          });
          break;

        case 'reasoning-delta':
          callbacks.setStreamingMessage((prev) => {
            if (!prev || prev.id !== event.messageId) return prev;
            return { ...prev, reasoning: (prev.reasoning ?? '') + event.delta };
          });
          break;

        case 'text-complete': {
          // Capture reasoning before clearing streaming message
          const reasoningContent = streamingMessageRef.current?.reasoning;
          callbacks.setStreamingMessage(null);

          // Build message parts from tracked tool calls and reasoning
          const parts: MessagePart[] = [];

          // Add reasoning part if exists
          if (reasoningContent && reasoningContent.length > 0) {
            parts.push({
              type: 'reasoning',
              content: reasoningContent,
              isVisible: true,
            });
          }

          // Add tool call parts
          for (const tc of toolCallsRef.current.values()) {
            parts.push({
              type: 'tool-call',
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args,
              state:
                tc.state === 'completed'
                  ? 'completed'
                  : tc.state === 'failed'
                    ? 'failed'
                    : 'executing',
            });
            if (tc.result !== undefined) {
              parts.push({
                type: 'tool-result',
                toolCallId: tc.toolCallId,
                result: tc.result,
              });
            }
          }

          callbacks.addMessage({
            id: event.messageId,
            role: 'assistant',
            content: event.content,
            createdAt: new Date(),
            agentId: activeAgentRef.current ?? undefined,
            parts: parts.length > 0 ? parts : undefined,
          });
          break;
        }

        case 'tool-call-start':
          toolCallsRef.current.set(event.toolCallId, {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            state: 'pending',
          });
          break;

        case 'tool-call-args': {
          const tc = toolCallsRef.current.get(event.toolCallId);
          if (tc) {
            tc.args = event.args;

            // Check if this is a frontend tool/action
            const frontendTool = frontendToolsRef.current.get(tc.toolName) as
              | { execute?: (args: unknown) => Promise<unknown> }
              | undefined;

            const executeFn = frontendTool?.execute;
            if (executeFn) {
              // Execute frontend tool locally
              tc.state = 'executing';

              // Capture args for the async closure
              const toolArgs = event.args;

              // Execute asynchronously without blocking the event handler
              (async () => {
                try {
                  const result = await executeFn(toolArgs);
                  tc.result = result;
                  tc.state = 'completed';
                } catch (err) {
                  tc.result = { error: err instanceof Error ? err.message : String(err) };
                  tc.state = 'failed';
                }
              })();
            } else {
              // Server-side tool, wait for result from stream
              tc.state = 'executing';
            }
          }
          break;
        }

        case 'tool-call-result': {
          const tc = toolCallsRef.current.get(event.toolCallId);
          if (tc) {
            tc.result = event.result;
            tc.state = 'completed';
          }
          break;
        }

        case 'tool-call-error': {
          const tc = toolCallsRef.current.get(event.toolCallId);
          if (tc) {
            tc.result = { error: event.error };
            tc.state = 'failed';
          }
          break;
        }

        case 'agent-handoff':
          callbacks.setActiveAgent(event.toAgent);
          callbacks.addHandoff({
            fromAgent: event.fromAgent,
            toAgent: event.toAgent,
            reason: event.reason,
          });
          break;

        case 'approval-required': {
          const approvalRequest: ToolApprovalRequest = {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            agentId: event.agentId,
            timestamp: new Date(),
          };
          callbacks.addPendingApproval(approvalRequest);

          // Update the tool call state to awaiting-approval
          const tc = toolCallsRef.current.get(event.toolCallId);
          if (tc) {
            tc.state = 'pending';
          }
          break;
        }

        case 'stream-complete':
          callbacks.setIsStreaming(false);
          callbacks.setStreamingMessage(null);
          currentMessageIdRef.current = null;
          break;

        case 'error':
          callbacks.setIsStreaming(false);
          callbacks.setStreamingMessage(null);
          callbacks.setError(new Error(event.error));
          currentMessageIdRef.current = null;
          break;
      }
    };

    const unsubscribe = transport.onMessage(handleEvent);

    return () => {
      unsubscribe();
      transport.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.endpoint]);

  const sendMessage = useCallback(
    async (content: string, _attachments?: Attachment[]) => {
      if (!transportRef.current || !conversationId) {
        setError(new Error('Transport not ready'));
        return;
      }

      // Clear any previous error
      setError(null);

      // Add user message optimistically
      const userMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        createdAt: new Date(),
      };
      addMessage(userMessage);

      // Send to transport
      transportRef.current.send({
        type: 'send-message',
        message: content,
        conversationId,
        context: frontendContext,
      });
    },
    [conversationId, frontendContext, addMessage, setError]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  const reset = useCallback(() => {
    clearMessages();
    clearHandoffs();
    setError(null);
    setIsStreaming(false);
    setStreamingMessage(null);
    setConversationId(crypto.randomUUID());
  }, [
    clearMessages,
    clearHandoffs,
    setError,
    setIsStreaming,
    setStreamingMessage,
    setConversationId,
  ]);

  const stop = useCallback(() => {
    transportRef.current?.disconnect();
    transportRef.current = new SSETransport();
    transportRef.current.connect(configRef.current);
    setIsStreaming(false);
    setStreamingMessage(null);
  }, [setIsStreaming, setStreamingMessage]);

  const regenerate = useCallback(async () => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) return;

    // Remove messages after the last user message
    const lastUserIndex = messages.findIndex((m) => m.id === lastUserMessage.id);
    setMessages(messages.slice(0, lastUserIndex + 1));

    // Resend the last user message
    if (transportRef.current && conversationId) {
      transportRef.current.send({
        type: 'send-message',
        message: lastUserMessage.content,
        conversationId,
        context: frontendContext,
      });
    }
  }, [messages, conversationId, frontendContext, setMessages]);

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      // Update the message
      updateMessage({ id: messageId, updates: { content: newContent } });

      // Remove all messages after this one
      setMessages(messages.slice(0, messageIndex + 1));

      // If it's a user message, regenerate the response
      const message = messages[messageIndex];
      if (message.role === 'user' && transportRef.current && conversationId) {
        transportRef.current.send({
          type: 'send-message',
          message: newContent,
          conversationId,
          context: frontendContext,
        });
      }
    },
    [messages, conversationId, frontendContext, updateMessage, setMessages]
  );

  // Combine streaming message with messages for display
  const displayMessages = streamingMessage
    ? [
        ...messages,
        {
          id: streamingMessage.id,
          role: 'assistant' as const,
          content: streamingMessage.content,
          createdAt: new Date(),
          agentId: streamingMessage.agentId,
          // Include reasoning as a MessagePart during streaming
          parts: streamingMessage.reasoning
            ? [
                {
                  type: 'reasoning' as const,
                  content: streamingMessage.reasoning,
                  isVisible: true,
                },
              ]
            : undefined,
        },
      ]
    : messages;

  return {
    messages: displayMessages,
    sendMessage,
    isStreaming,
    activeAgent,
    error,
    clearError,
    reset,
    stop,
    regenerate,
    editMessage,
    conversationId,
    handoffHistory,
    lastHandoff,
    pendingApprovals,
  };
}
