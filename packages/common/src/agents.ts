import type { ModelConfig } from './models.js';
import type { ToolDefinition } from './tools.js';

/**
 * @description
 * Context available to agents during conversation execution, including conversation
 * metadata and client-provided data.
 *
 * Passed to dynamic system prompts (when `systemPrompt` is a function) and to
 * {@link RuntimeHooks} lifecycle callbacks. The `frontendContext` field contains
 * arbitrary data sent by the client with each request.
 *
 * Related: {@link AgentDefinition} uses this for dynamic system prompts,
 * {@link ToolContext} carries a subset of this context to tools.
 *
 * @docsCategory agent-config
 */
export interface AgentContext {
  conversationId: string;
  userId?: string;
  frontendContext: Record<string, unknown>;
}

/**
 * @description
 * Complete specification for an AI agent, defining its identity, LLM backend, tools, and routing.
 *
 * Each agent has a unique ID, a display name, an LLM configuration ({@link ModelConfig}), and a
 * system prompt that can be static or dynamic (receiving {@link AgentContext}). Agents declare
 * their available tools and can optionally access MCP servers and hand off to other agents.
 *
 * The `canHandoffTo` field enables the multi-agent swarm pattern: the runtime auto-generates
 * `handoff_to_<agentId>` tools for each target agent, allowing the LLM to route conversations.
 * The `maxIterations` field provides a safety limit on tool-call loops per turn.
 *
 * Related: {@link RuntimeConfig} collects agents, {@link AgentRuntime} orchestrates them,
 * {@link ModelConfig} configures the LLM, {@link ToolDefinition} defines available tools.
 *
 * @docsCategory agent-config
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  model: ModelConfig;
  systemPrompt: string | ((context: AgentContext) => string);
  tools: ToolDefinition[];
  /** MCP servers this agent can use */
  allowedMcpServers?: string[];
  canHandoffTo?: string[];
  maxIterations?: number;
}
