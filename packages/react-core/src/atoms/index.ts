import { atom } from 'jotai';
import type {
  AgentConfig,
  AgentMessage,
  AgentTransport,
  ToolApprovalRequest,
  ActionExecutionState,
  PendingActionConfirmation,
} from '../types.js';

// === Core Atoms ===

/**
 * @description
 * Stores the current {@link AgentConfig} for the agent connection.
 *
 * Initialized by {@link AgentProvider} or {@link useAgent} when a config is provided.
 * Read by {@link SSETransport} and hooks to determine endpoint, headers, and other settings.
 *
 * @docsCategory state-management
 */
export const agentConfigAtom = atom<AgentConfig | null>(null);

/**
 * @description
 * Stores all messages in the current conversation as an ordered array.
 *
 * Updated by {@link useAgent} as streaming events arrive (via {@link addMessageAtom}).
 * Read by UI components like {@link MessageList} and {@link ChatWindow} for rendering.
 *
 * @docsCategory state-management
 */
export const messagesAtom = atom<AgentMessage[]>([]);

/**
 * @description
 * Indicates whether the agent is currently streaming a response.
 *
 * Set to `true` on `message-start` events and `false` on `stream-complete` or `error`.
 * Used by {@link StreamingIndicator} and {@link InputComposer} to show loading state
 * and disable input during streaming.
 *
 * @docsCategory state-management
 */
export const isStreamingAtom = atom<boolean>(false);

/**
 * @description
 * Stores the ID of the currently active agent in a multi-agent setup.
 *
 * Updated on `message-start` and `agent-handoff` events. Used by {@link AgentBadge}
 * and {@link AgentSwitcher} to display which agent is responding.
 *
 * @docsCategory state-management
 */
export const activeAgentAtom = atom<string | null>(null);

/**
 * @description
 * Stores tool calls pending user approval.
 *
 * Populated when `approval-required` {@link TransportEvent}s arrive. Consumed by
 * {@link useToolApproval} and rendered by {@link ToolApprovalDialog}.
 * Entries are removed via {@link removePendingApprovalAtom} after the user decides.
 *
 * @docsCategory state-management
 */
export const pendingToolCallsAtom = atom<ToolApprovalRequest[]>([]);

/**
 * @description
 * Stores the current error state, if any.
 *
 * Set when transport or streaming errors occur. Cleared by {@link useAgent}.clearError()
 * or on the next successful message send.
 *
 * @docsCategory state-management
 */
export const errorAtom = atom<Error | null>(null);

/**
 * @description
 * Stores the current conversation ID.
 *
 * Auto-generated via `crypto.randomUUID()` if not provided in {@link AgentConfig}.
 * Sent with every {@link TransportMessage} to correlate server-side conversation state.
 *
 * @docsCategory state-management
 */
export const conversationIdAtom = atom<string | null>(null);

/**
 * @description
 * Stores the message currently being streamed for real-time rendering.
 *
 * Contains accumulated `content` and `reasoning` text deltas. Set on `message-start`,
 * updated on `text-delta` and `reasoning-delta`, cleared on `text-complete` or `error`.
 * {@link useAgent} merges this into the display messages array for live preview.
 *
 * @docsCategory state-management
 */
export const streamingMessageAtom = atom<{
  id: string;
  content: string;
  reasoning: string;
  agentId: string;
} | null>(null);

/**
 * @description
 * Stores frontend context key-value pairs sent with every agent request.
 *
 * Managed by {@link useAgentContext} hook. Each entry provides the agent with
 * information about the current application state (e.g., current page, user preferences).
 *
 * @docsCategory state-management
 */
export const frontendContextAtom = atom<Record<string, unknown>>({});

/**
 * @description
 * Registry of frontend tools and actions available for local execution.
 *
 * Populated by {@link useAgentTool} and {@link useAgentAction} hooks.
 * When the LLM calls a tool whose name matches an entry in this map,
 * {@link useAgent} executes it locally instead of waiting for a server result.
 *
 * @docsCategory state-management
 */
export const frontendToolsAtom = atom<Map<string, unknown>>(new Map());

/**
 * @description
 * Stores the current {@link AgentTransport} instance for sending messages and approvals.
 *
 * Set by {@link useAgent} during initialization. Read by {@link useToolApproval}
 * to send approval decisions to the server.
 *
 * @docsCategory state-management
 */
export const transportAtom = atom<AgentTransport | null>(null);

/**
 * @description
 * Represents a recorded agent handoff event for UI display.
 *
 * Created by {@link addHandoffAtom} when an `agent-handoff` {@link TransportEvent}
 * is received. Displayed by {@link HandoffIndicator}.
 *
 * @docsCategory state-management
 */
export interface HandoffEvent {
  id: string;
  fromAgent: string;
  toAgent: string;
  reason: string;
  timestamp: Date;
}

/**
 * @description
 * Stores the chronological history of agent handoffs in the current conversation.
 *
 * Appended to by {@link addHandoffAtom}. Cleared by {@link clearHandoffsAtom}
 * on conversation reset.
 *
 * @docsCategory state-management
 */
export const handoffHistoryAtom = atom<HandoffEvent[]>([]);

/**
 * @description
 * Stores the most recent handoff event for showing a transient indicator.
 *
 * Set alongside {@link handoffHistoryAtom} by {@link addHandoffAtom}.
 * Used by {@link HandoffIndicator} for the most recent transition display.
 *
 * @docsCategory state-management
 */
export const lastHandoffAtom = atom<HandoffEvent | null>(null);

// === Derived Atoms ===

/**
 * @description
 * Derived atom that returns the last message in the conversation, or null if empty.
 *
 * @docsCategory state-management
 */
export const lastMessageAtom = atom((get) => {
  const messages = get(messagesAtom);
  return messages[messages.length - 1] ?? null;
});

/**
 * @description
 * Derived atom that returns the count of pending tool approval requests.
 *
 * Used by {@link PendingApprovalBadge} to display a notification count.
 *
 * @docsCategory state-management
 */
export const pendingApprovalCountAtom = atom((get) => {
  return get(pendingToolCallsAtom).length;
});

/**
 * @description
 * Derived atom that returns whether there are any pending tool approvals.
 *
 * @docsCategory state-management
 */
export const hasPendingApprovalsAtom = atom((get) => {
  return get(pendingToolCallsAtom).length > 0;
});

/**
 * @description
 * Derived atom that filters messages to only user-role messages.
 *
 * @docsCategory state-management
 */
export const userMessagesAtom = atom((get) => {
  return get(messagesAtom).filter((m) => m.role === 'user');
});

/**
 * @description
 * Derived atom that filters messages to only assistant-role messages.
 *
 * @docsCategory state-management
 */
export const assistantMessagesAtom = atom((get) => {
  return get(messagesAtom).filter((m) => m.role === 'assistant');
});

/**
 * @description
 * Derived atom that returns the total number of messages in the conversation.
 *
 * @docsCategory state-management
 */
export const messageCountAtom = atom((get) => {
  return get(messagesAtom).length;
});

// === Write Atoms ===

/**
 * @description
 * Write atom that appends a new message to the conversation.
 *
 * Called by {@link useAgent} when user messages are sent optimistically
 * and when assistant messages are finalized on `text-complete`.
 *
 * @docsCategory state-management
 */
export const addMessageAtom = atom(null, (get, set, message: AgentMessage) => {
  const messages = get(messagesAtom);
  set(messagesAtom, [...messages, message]);
});

/**
 * @description
 * Write atom that updates a specific message by ID with partial updates.
 *
 * Used by {@link useAgent}.editMessage() to modify message content in place.
 *
 * @docsCategory state-management
 */
export const updateMessageAtom = atom(
  null,
  (get, set, { id, updates }: { id: string; updates: Partial<AgentMessage> }) => {
    const messages = get(messagesAtom);
    set(
      messagesAtom,
      messages.map((m) => (m.id === id ? { ...m, ...updates } : m))
    );
  }
);

/**
 * @description
 * Write atom that removes all messages from the conversation.
 *
 * Called by {@link useAgent}.reset() to clear conversation state.
 *
 * @docsCategory state-management
 */
export const clearMessagesAtom = atom(null, (_get, set) => {
  set(messagesAtom, []);
});

/**
 * @description
 * Write atom that adds a new pending tool approval request.
 *
 * Called by {@link useAgent} when an `approval-required` event arrives.
 *
 * @docsCategory state-management
 */
export const addPendingApprovalAtom = atom(null, (get, set, request: ToolApprovalRequest) => {
  const pending = get(pendingToolCallsAtom);
  set(pendingToolCallsAtom, [...pending, request]);
});

/**
 * @description
 * Write atom that removes a pending approval by tool call ID.
 *
 * Called by {@link useToolApproval} after the user approves or rejects a tool call.
 *
 * @docsCategory state-management
 */
export const removePendingApprovalAtom = atom(null, (get, set, toolCallId: string) => {
  const pending = get(pendingToolCallsAtom);
  set(
    pendingToolCallsAtom,
    pending.filter((p) => p.toolCallId !== toolCallId)
  );
});

/**
 * @description
 * Write atom that sets or updates a key in the frontend context.
 *
 * Called by {@link useAgentContext} when context values change.
 *
 * @docsCategory state-management
 */
export const updateContextAtom = atom(
  null,
  (get, set, { key, value }: { key: string; value: unknown }) => {
    const context = get(frontendContextAtom);
    set(frontendContextAtom, { ...context, [key]: value });
  }
);

/**
 * @description
 * Write atom that removes a key from the frontend context.
 *
 * Called by {@link useAgentContext} on component unmount when `persistent` is false.
 *
 * @docsCategory state-management
 */
export const removeContextAtom = atom(null, (get, set, key: string) => {
  const context = get(frontendContextAtom);
  const { [key]: _, ...rest } = context;
  set(frontendContextAtom, rest);
});

/**
 * @description
 * Write atom that records a handoff event with auto-generated ID and timestamp.
 *
 * Called by {@link useAgent} when an `agent-handoff` event arrives. Updates both
 * {@link handoffHistoryAtom} and {@link lastHandoffAtom}.
 *
 * @docsCategory state-management
 */
export const addHandoffAtom = atom(
  null,
  (get, set, handoff: Omit<HandoffEvent, 'id' | 'timestamp'>) => {
    const event: HandoffEvent = {
      ...handoff,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    const history = get(handoffHistoryAtom);
    set(handoffHistoryAtom, [...history, event]);
    set(lastHandoffAtom, event);
  }
);

/**
 * @description
 * Write atom that clears all handoff history and the last handoff reference.
 *
 * Called by {@link useAgent}.reset() during conversation reset.
 *
 * @docsCategory state-management
 */
export const clearHandoffsAtom = atom(null, (_get, set) => {
  set(handoffHistoryAtom, []);
  set(lastHandoffAtom, null);
});

// === Action Execution Atoms ===

/**
 * @description
 * Stores the list of currently executing or recently completed actions.
 *
 * Managed by {@link useAgentAction} via add/update/remove write atoms.
 * Provides global observability into action execution state.
 *
 * @docsCategory state-management
 */
export const executingActionsAtom = atom<ActionExecutionState[]>([]);

/**
 * @description
 * Stores pending action confirmations waiting for user decision.
 *
 * Created when an action with a `confirmationMessage` is triggered.
 * Rendered by {@link ActionConfirmDialog}.
 *
 * @docsCategory state-management
 */
export const pendingActionConfirmationsAtom = atom<PendingActionConfirmation[]>([]);

/**
 * @description
 * Write atom that adds a new action execution to the tracking list.
 *
 * Called by {@link useAgentAction}.execute() when an action starts.
 *
 * @docsCategory state-management
 */
export const addExecutingActionAtom = atom(null, (get, set, action: ActionExecutionState) => {
  const actions = get(executingActionsAtom);
  set(executingActionsAtom, [...actions, action]);
});

/**
 * @description
 * Write atom that updates an existing action execution by ID.
 *
 * Called by {@link useAgentAction} to transition action status
 * from `executing` to `completed` or `failed`.
 *
 * @docsCategory state-management
 */
export const updateExecutingActionAtom = atom(
  null,
  (get, set, update: Partial<ActionExecutionState> & { id: string }) => {
    const actions = get(executingActionsAtom);
    set(
      executingActionsAtom,
      actions.map((a) => (a.id === update.id ? { ...a, ...update } : a))
    );
  }
);

/**
 * @description
 * Write atom that removes a completed or failed action from the tracking list.
 *
 * Called by {@link useAgentAction} after a delay following action completion.
 *
 * @docsCategory state-management
 */
export const removeExecutingActionAtom = atom(null, (get, set, id: string) => {
  const actions = get(executingActionsAtom);
  set(
    executingActionsAtom,
    actions.filter((a) => a.id !== id)
  );
});

/**
 * @description
 * Write atom that adds a pending action confirmation entry.
 *
 * Created when an action with `confirmationMessage` is triggered, before execution.
 *
 * @docsCategory state-management
 */
export const addPendingActionConfirmationAtom = atom(
  null,
  (get, set, confirmation: PendingActionConfirmation) => {
    const confirmations = get(pendingActionConfirmationsAtom);
    set(pendingActionConfirmationsAtom, [...confirmations, confirmation]);
  }
);

/**
 * @description
 * Write atom that removes a pending action confirmation by ID.
 *
 * Called after the user confirms or cancels the action.
 *
 * @docsCategory state-management
 */
export const removePendingActionConfirmationAtom = atom(null, (get, set, id: string) => {
  const confirmations = get(pendingActionConfirmationsAtom);
  set(
    pendingActionConfirmationsAtom,
    confirmations.filter((c) => c.id !== id)
  );
});

/**
 * @description
 * Derived atom that returns whether any action is currently in the `executing` state.
 *
 * @docsCategory state-management
 */
export const isAnyActionExecutingAtom = atom((get) => {
  return get(executingActionsAtom).some((a) => a.status === 'executing');
});

/**
 * @description
 * Derived atom that returns the count of pending action confirmations.
 *
 * @docsCategory state-management
 */
export const pendingActionConfirmationCountAtom = atom((get) => {
  return get(pendingActionConfirmationsAtom).length;
});
