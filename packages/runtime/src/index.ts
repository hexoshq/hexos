/**
 * @packageDocumentation
 * @hexos/runtime — Server-side agent runtime for the Hexos framework.
 *
 * Provides {@link AgentRuntime} for orchestrating multi-agent conversations with LLM providers
 * (Anthropic, OpenAI, Ollama), tool execution with human-in-the-loop approvals, MCP server
 * integration, and streaming event output. Includes framework handlers for Next.js and Express.
 */

export * from './types.js';
export * from './AgentRuntime.js';
export * from './handlers/nextjs.js';
export * from './tools/handoff.js';
export * from './mcp/index.js';
