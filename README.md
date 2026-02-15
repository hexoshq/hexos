# Hexos

A React library for building AI agent chat applications with streaming, multi-agent coordination, and human-in-the-loop tool approvals.

## Features

- **Multi-LLM Support** — Anthropic, OpenAI, and Ollama providers out of the box
- **Multi-Agent Swarm** — Agents can hand off conversations to each other with automatic routing
- **Streaming SSE** — Real-time token streaming via Server-Sent Events
- **Human-in-the-Loop** — Tool approval system for sensitive operations
- **MCP Integration** — Connect to Model Context Protocol servers (stdio and SSE transports)
- **Frontend Tools** — Register browser-side tools that the LLM can invoke directly
- **Theming** — Fully customizable chat UI with theme provider
- **Framework Handlers** — Built-in support for Next.js App Router and Express

## Packages

| Package | Description |
|---------|-------------|
| [`@hexos/common`](packages/common/) | Shared types, enums, and utilities |
| [`@hexos/react-core`](packages/react-core/) | React hooks, Jotai atoms, and SSE transport |
| [`@hexos/react-ui`](packages/react-ui/) | Pre-built chat UI components |
| [`@hexos/runtime`](packages/runtime/) | Server-side agent runtime with LLM providers |

## Quick Start

### Install

```bash
# Install all packages
npm install @hexos/react-core @hexos/react-ui @hexos/runtime @hexos/common
```

### Install in Existing Next.js App

Use the CLI when you already have a Next.js App Router project and want to add Hexos without scaffolding from scratch:

```bash
npx @hexos/cli install
```

Upgrade managed Hexos files and dependencies later with:

```bash
npx @hexos/cli upgrade
```

### Backend (Next.js App Router)

```typescript
// app/api/agent/chat/route.ts
import { AgentRuntime, createAgentHandler } from '@hexos/runtime';
import { LLMProvider, AnthropicModel } from '@hexos/common';

const runtime = new AgentRuntime({
  agents: [
    {
      id: 'assistant',
      name: 'Assistant',
      description: 'A helpful assistant',
      model: {
        provider: LLMProvider.Anthropic,
        model: AnthropicModel.Claude4Sonnet,
      },
      systemPrompt: 'You are a helpful assistant.',
      tools: [],
    },
  ],
  defaultAgent: 'assistant',
});

export const POST = createAgentHandler(runtime);
```

### Frontend (React)

```tsx
import { AgentProvider } from '@hexos/react-core';
import { ChatWindow, AgentUIProvider } from '@hexos/react-ui';
import '@hexos/react-ui/styles.css';

function App() {
  return (
    <AgentProvider config={{ endpoint: '/api/agent/chat' }}>
      <AgentUIProvider>
        <ChatWindow config={{ endpoint: '/api/agent/chat' }} />
      </AgentUIProvider>
    </AgentProvider>
  );
}
```

## Monorepo Structure

```
packages/
├── common/          # @hexos/common — Shared types and utilities
├── react-core/      # @hexos/react-core — React hooks and state management
├── react-ui/        # @hexos/react-ui — Chat UI components
└── runtime/         # @hexos/runtime — Server-side agent runtime

apps/
├── docs/            # Documentation site (Nextra)
├── example-nextjs/  # Next.js demo application
└── example-nestjs/  # NestJS backend with MCP server
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development mode
pnpm dev

# Run tests
pnpm test

# Lint
pnpm lint
```

## Requirements

- Node.js >= 20.0.0
- pnpm 9.15.0

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OLLAMA_HOST` | Ollama server URL (default: `http://localhost:11434`) |

## License

MIT
