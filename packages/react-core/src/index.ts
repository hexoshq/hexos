/**
 * @packageDocumentation
 * @hexos/react-core — React hooks, Jotai atoms, and SSE transport for Hexos.
 *
 * Provides the frontend state management and communication layer for building
 * AI agent chat applications. Core exports include:
 *
 * - **Hooks**: {@link useAgent}, {@link useAgentContext}, {@link useAgentTool},
 *   {@link useAgentAction}, {@link useToolApproval}
 * - **State**: Jotai atoms for messages, streaming, agents, approvals, and actions
 * - **Transport**: {@link SSETransport} for Server-Sent Events communication
 * - **Provider**: {@link AgentProvider} for initializing the Jotai store
 * - **Types**: {@link AgentMessage}, {@link AgentConfig}, {@link TransportEvent}, etc.
 */

// Types
export * from './types.js';

// Atoms (for advanced usage)
export * from './atoms/index.js';

// Hooks
export { useAgent, type UseAgentReturn } from './hooks/useAgent.js';
export { useAgentContext } from './hooks/useAgentContext.js';
export { useAgentTool, useFrontendTool, useFrontendTools } from './hooks/useAgentTool.js';
export { useAgentAction, type UseAgentActionReturn } from './hooks/useAgentAction.js';
export { useToolApproval, type UseToolApprovalReturn } from './hooks/useToolApproval.js';

// Provider
export { AgentProvider, type AgentProviderProps } from './provider/AgentProvider.js';

// Transport
export { SSETransport } from './transport/SSETransport.js';
