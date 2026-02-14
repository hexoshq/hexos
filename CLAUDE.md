# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hexos is a React library for building AI agent chat applications. It's a pnpm monorepo with Turborepo orchestration, consisting of shared packages and example applications.

## Build & Development Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development mode (all packages/apps)
pnpm dev

# Run tests
pnpm test

# Lint
pnpm lint

# Clean all builds
pnpm clean
```

### Per-Package Commands

```bash
# Build/dev specific package
pnpm --filter @hexos/react-core build
pnpm --filter @hexos/react-core dev

# Run tests with watch mode (vitest)
pnpm --filter @hexos/react-core test:watch

# NestJS example has different test commands
pnpm --filter example-nestjs test          # Jest
pnpm --filter example-nestjs test:watch
pnpm --filter example-nestjs test:e2e
```

### Running Examples

```bash
# Next.js example
pnpm --filter example-nextjs dev

# NestJS example (MCP server)
pnpm --filter example-nestjs start:dev

# Documentation site
pnpm --filter docs dev
```

## Architecture

### Monorepo Structure

```
packages/
├── common/        # @hexos/common - Shared types and utilities
├── react-core/    # @hexos/react-core - React hooks, Jotai atoms, SSE transport
├── react-ui/      # @hexos/react-ui - Chat UI components (depends on react-core)
└── runtime/       # @hexos/runtime - Server-side agent runtime with LLM providers

apps/
├── docs/          # Nextra documentation site
├── example-nextjs/ # Next.js demo app using all packages
└── example-nestjs/ # NestJS backend with MCP server support
```

### Package Dependencies

- `@hexos/react-ui` depends on `@hexos/react-core`
- `@hexos/runtime` depends on `@hexos/common`
- Example apps depend on all packages via `workspace:*`

### Key Architectural Concepts

**Frontend (react-core)**
- State management via Jotai atoms (`messagesAtom`, `isStreamingAtom`, `activeAgentAtom`, `pendingApprovalsAtom`)
- Hooks: `useAgent()`, `useAgentTool()`, `useAgentContext()`, `useAgentAction()`, `useToolApproval()`
- SSE transport for streaming from server

**Backend (runtime)**
- `AgentRuntime` class orchestrates LLM calls and tool execution
- Supports Anthropic, OpenAI, and Ollama providers
- Multi-agent swarm pattern with handoff tools
- MCP (Model Context Protocol) client support for external tool servers
- Human-in-the-loop via `requiresApproval` on tools

**Data Flow**
1. User input → `useAgent().sendMessage()` → SSE POST to `/api/agent/chat`
2. `AgentRuntime.stream()` → LLM provider → yields `RuntimeEvent`s
3. Events streamed via SSE → `SSETransport` → Jotai atoms updated
4. React re-renders with new messages/tool calls

### Tool Execution Flow

1. LLM requests tool call
2. Runtime checks `requiresApproval` flag
3. If approval required: emits `approval-required` event, waits for `submitApproval()`
4. Executes tool, returns result to LLM
5. Handoff tools (`handoff_to_<agent>`) trigger agent switch

### MCP Integration

The runtime supports MCP servers via stdio or SSE transport:
```typescript
mcpServers: {
  'server-name': {
    transport: 'sse',
    url: 'http://localhost:3000/mcp/sse',
    headers: { Authorization: 'Bearer xxx' },
  },
}
```

Agents specify `allowedMcpServers: ['server-name']` to access those tools.

## Code Conventions

- ESM modules throughout (`"type": "module"`)
- TypeScript with strict mode
- Zod for schema validation (tool input schemas)
- tsup for package bundling
- vitest for package tests, jest for NestJS

## Environment Requirements

- Node.js >= 20.0.0
- pnpm 9.15.0
- LLM provider API keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- Ollama host (optional): `OLLAMA_HOST` (defaults to localhost:11434)
