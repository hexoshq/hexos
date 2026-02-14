# @hexos/react-ui

Pre-built React UI components for creating AI agent chat interfaces with Hexos.

## Installation

```bash
npm install @hexos/react-ui
```

**Peer dependencies:** `react ^18.0.0 || ^19.0.0`, `react-dom ^18.0.0 || ^19.0.0`

**Required:** `@hexos/react-core` (installed automatically as a dependency)

## Quick Start

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

## CSS Imports

The package provides two CSS options:

```typescript
import '@hexos/react-ui/styles.css';    // Custom CSS (lighter)
import '@hexos/react-ui/tailwind.css';  // Compiled Tailwind CSS
```

## Components

### Core Chat

| Component | Description |
|-----------|-------------|
| `ChatWindow` | Full chat interface with messages, input, streaming indicator, and agent status |
| `MessageList` | Scrollable message history with auto-scroll |
| `MessageBubble` | Single message with role-specific styling, tool calls, and reasoning |
| `InputComposer` | Auto-resizing textarea with submit on Enter |
| `StreamingIndicator` | Animated typing indicator during streaming |
| `QuickReplies` | Suggestion chips for quick user actions |

### Agent Coordination

| Component | Description |
|-----------|-------------|
| `AgentBadge` | Color-coded agent identity chip |
| `AgentSwitcher` | Multi-agent selection interface |
| `AgentStatusBar` | Current agent status display |
| `HandoffIndicator` | Visual marker for agent-to-agent transitions |

### Tool Execution

| Component | Description |
|-----------|-------------|
| `ToolCallRenderer` | Tool execution display with state (pending/executing/completed/failed) |
| `ToolApprovalDialog` | Modal for human-in-the-loop approval decisions |
| `ToolApprovalContainer` | Automatic approval dialog management |
| `PendingApprovalBadge` | Approval queue count badge |
| `ActionConfirmDialog` | Confirmation dialog for agent-triggered actions |
| `ActionConfirmContainer` | Automatic action confirmation management |

### Primitives

| Component | Description |
|-----------|-------------|
| `Button` | Styled button with CVA variants |
| `Textarea` | Auto-resizing textarea |

## ChatWindow Props

```tsx
<ChatWindow
  config={{ endpoint: '/api/agent/chat' }}
  variant="default"          // 'default' | 'floating' | 'fullscreen' | 'sidebar'
  placeholder="Type a message..."
  showReasoning              // Show LLM extended thinking
  showAgentBadges            // Show agent identity badges on messages
  showHandoffs               // Show handoff indicators between messages
  showAgentStatus            // Show agent status bar
  enableMessageActions       // Enable edit/regenerate on messages
  handoffVariant="inline"    // 'inline' | 'card'
  header={<CustomHeader />}
  emptyState={<Welcome />}
  renderMessage={(msg) => <CustomMessage message={msg} />}
  renderInput={(props) => <CustomInput {...props} />}
  suggestions={['Hello', 'Help me with...']}
  suggestionsTitle="Quick start"
  agents={[
    { id: 'main', name: 'Main Assistant' },
    { id: 'code', name: 'Code Helper' },
  ]}
/>
```

## Theming

Customize the appearance with `AgentUIProvider`:

```tsx
import { AgentUIProvider } from '@hexos/react-ui';

<AgentUIProvider
  theme={{
    colors: {
      primary: '#8b5cf6',
      userBubble: '#3b82f6',
      assistantBubble: '#f3f4f6',
      toolCall: '#fef3c7',
      reasoning: '#f9fafb',
    },
    borderRadius: '0.75rem',
    fonts: {
      body: 'Inter, sans-serif',
    },
  }}
  displayConfig={{
    toolDisplayMode: 'minimal',  // 'full' | 'minimal' | 'hidden'
  }}
>
  {children}
</AgentUIProvider>
```

Access theme values in custom components:

```typescript
import { useAgentUITheme, useDisplayConfig } from '@hexos/react-ui';

const theme = useAgentUITheme();
const displayConfig = useDisplayConfig();
```

## License

MIT
