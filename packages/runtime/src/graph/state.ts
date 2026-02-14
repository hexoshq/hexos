import { Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { ToolApproval, HandoffRecord } from '../types.js';

/**
 * LangGraph state schema for the agent runtime.
 * Uses Annotation pattern for type-safe state with reducers.
 */
export const AgentState = Annotation.Root({
  // Conversation messages (accumulating)
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Currently active agent ID
  activeAgent: Annotation<string>({
    reducer: (_, next) => next,
    default: () => 'main',
  }),

  // Context provided by frontend
  frontendContext: Annotation<Record<string, unknown>>({
    reducer: (_, next) => next,
    default: () => ({}),
  }),

  // Tool calls pending user approval
  pendingApprovals: Annotation<ToolApproval[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // History of agent handoffs
  handoffHistory: Annotation<HandoffRecord[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),

  // Current iteration count (for max iterations check)
  iterationCount: Annotation<number>({
    reducer: (prev) => prev + 1,
    default: () => 0,
  }),

  // Error state
  error: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Final response (set when complete)
  finalResponse: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Conversation ID for persistence
  conversationId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // User ID (optional)
  userId: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

export type AgentStateType = typeof AgentState.State;
