# @hexos/react-core

React hooks, Jotai atoms, and SSE transport for building AI agent chat applications with Hexos.

## Installation

```bash
npm install @hexos/react-core
```

**Peer dependency:** `react ^18.0.0 || ^19.0.0`

## Quick Start

```tsx
import { AgentProvider, useAgent } from '@hexos/react-core';

function App() {
  return (
    <AgentProvider config={{ endpoint: '/api/agent/chat' }}>
      <Chat />
    </AgentProvider>
  );
}

function Chat() {
  const { messages, sendMessage, isStreaming } = useAgent({
    endpoint: '/api/agent/chat',
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')} disabled={isStreaming}>
        Send
      </button>
    </div>
  );
}
```

## Hooks

### `useAgent(config)`

Primary hook for agent communication. Manages the full chat lifecycle including streaming, tool calls, approvals, and handoffs.

```typescript
const {
  messages,          // AgentMessage[] — conversation history
  sendMessage,       // (text: string, attachments?: Attachment[]) => void
  isStreaming,       // boolean — whether a response is being streamed
  activeAgent,       // string — current agent ID
  error,             // string | null
  clearError,        // () => void
  reset,             // () => void — clear all state
  stop,              // () => void — stop current stream
  regenerate,        // () => void — regenerate last response
  editMessage,       // (id: string, content: string) => void
  conversationId,    // string
  pendingApprovals,  // ToolApprovalRequest[]
  handoffHistory,    // HandoffRecord[]
  lastHandoff,       // HandoffRecord | null
} = useAgent(config);
```

### `useAgentContext(definition)`

Register key-value context sent with every agent request. Auto-removes on unmount unless `persistent: true`.

```typescript
useAgentContext({
  key: 'currentPage',
  description: 'The page the user is currently viewing',
  value: '/dashboard',
});
```

### `useAgentTool(definition)`

Register a browser-side tool the LLM can invoke directly in the frontend.

```typescript
import { z } from 'zod';

useAgentTool({
  name: 'show_notification',
  description: 'Show a notification to the user',
  inputSchema: z.object({ message: z.string() }),
  execute: async ({ message }) => {
    toast(message);
    return { shown: true };
  },
});
```

### `useAgentAction(definition)`

Agent-triggered state mutations with optimistic updates, rollback, and confirmation dialogs.

```typescript
const { isExecuting, lastResult } = useAgentAction({
  name: 'delete_item',
  description: 'Delete an item from the list',
  inputSchema: z.object({ itemId: z.string() }),
  handler: async ({ itemId }) => { /* ... */ },
  confirmationMessage: 'Are you sure you want to delete this item?',
});
```

### `useToolApproval()`

Manage pending tool approval requests for human-in-the-loop workflows.

```typescript
const {
  pending,     // ToolApprovalRequest[]
  approve,     // (id: string) => void
  reject,      // (id: string, reason?: string) => void
  approveAll,  // () => void
  rejectAll,   // (reason?: string) => void
} = useToolApproval();
```

## Provider

### `AgentProvider`

Wraps your app with an isolated Jotai store for agent state.

```tsx
<AgentProvider config={{ endpoint: '/api/agent/chat', conversationId: 'abc' }}>
  {children}
</AgentProvider>
```

## Jotai Atoms

For advanced use cases, all state atoms are exported directly:

```typescript
import { messagesAtom, isStreamingAtom, activeAgentAtom } from '@hexos/react-core';
```

**Core atoms:** `messagesAtom`, `isStreamingAtom`, `activeAgentAtom`, `errorAtom`, `conversationIdAtom`, `streamingMessageAtom`, `pendingToolCallsAtom`, `handoffHistoryAtom`

**Derived atoms:** `lastMessageAtom`, `pendingApprovalCountAtom`, `userMessagesAtom`, `assistantMessagesAtom`, `messageCountAtom`

**Write atoms:** `addMessageAtom`, `updateMessageAtom`, `clearMessagesAtom`, `addPendingApprovalAtom`, `removePendingApprovalAtom`

## Transport

### `SSETransport`

Default transport implementation using HTTP POST with Server-Sent Events streaming.

```typescript
import { SSETransport } from '@hexos/react-core';

const transport = new SSETransport();
await transport.connect({ endpoint: '/api/agent/chat' });
transport.send({ type: 'send-message', message: 'Hello', conversationId: '123' });
transport.onMessage((event) => console.log(event));
```

## License

MIT
