/**
 * @packageDocumentation
 *
 * React UI components for building AI agent chat interfaces with Hexos.
 *
 * This package provides a comprehensive set of styled, accessible React components for creating
 * chat applications with AI agents. It includes message rendering, input handling, streaming
 * indicators, tool execution displays, and multi-agent coordination UI.
 *
 * ## Core Components
 *
 * - {@link ChatWindow} - Full-featured chat interface orchestrating all subcomponents
 * - {@link MessageList} - Scrollable message history with auto-scroll
 * - {@link MessageBubble} - Individual message renderer with tool calls and reasoning
 * - {@link InputComposer} - Message input with auto-resize and attachments
 *
 * ## Agent Coordination
 *
 * - {@link AgentBadge} - Color-coded agent identity badges
 * - {@link AgentSwitcher} - Multi-agent selection interface
 * - {@link AgentStatusBar} - Current agent status display
 * - {@link HandoffIndicator} - Visual agent transition markers
 *
 * ## Tool Execution
 *
 * - {@link ToolCallRenderer} - Tool execution display with state and results
 * - {@link ToolApprovalDialog} - Human-in-the-loop approval modal
 * - {@link ToolApprovalContainer} - Automatic approval dialog management
 * - {@link PendingApprovalBadge} - Approval queue status indicator
 *
 * ## Theming & Configuration
 *
 * - {@link AgentUIProvider} - Theme and display configuration provider
 * - {@link useAgentUITheme} - Access current theme
 * - {@link useDisplayConfig} - Access display configuration
 *
 * ## Primitives
 *
 * - {@link Button} - Styled button with variants
 * - {@link Textarea} - Auto-resizing textarea
 *
 * @example Basic chat window
 * ```tsx
 * import { ChatWindow, AgentUIProvider } from '@hexos/react-ui';
 *
 * function App() {
 *   return (
 *     <AgentUIProvider>
 *       <ChatWindow config={{ endpoint: '/api/agent/chat' }} />
 *     </AgentUIProvider>
 *   );
 * }
 * ```
 *
 * @example Themed multi-agent chat
 * ```tsx
 * <AgentUIProvider
 *   theme={{ colors: { primary: '#8b5cf6' } }}
 *   displayConfig={{ toolDisplayMode: 'minimal' }}
 * >
 *   <ChatWindow
 *     config={config}
 *     showAgentBadges
 *     showHandoffs
 *     agents={[
 *       { id: 'main', name: 'Main Assistant' },
 *       { id: 'code', name: 'Code Helper' }
 *     ]}
 *   />
 *   <ToolApprovalContainer />
 * </AgentUIProvider>
 * ```
 */

// @hexos/react-ui
// React UI components for Hexos chat interfaces

// Components
export { ChatWindow, type ChatWindowProps } from './components/ChatWindow.js';
export { MessageList, type MessageListProps } from './components/MessageList.js';
export { MessageBubble, type MessageBubbleProps } from './components/MessageBubble.js';
export { InputComposer, type InputComposerProps } from './components/InputComposer.js';
export {
  StreamingIndicator,
  type StreamingIndicatorProps,
} from './components/StreamingIndicator.js';
export { QuickReplies, type QuickRepliesProps } from './components/QuickReplies.js';
export {
  ToolCallRenderer,
  type ToolCallRendererProps,
  type ToolCallRenderProps,
} from './components/ToolCallRenderer.js';
export { ReasoningDisplay, type ReasoningDisplayProps } from './components/ReasoningDisplay.js';
export {
  AgentBadge,
  getAgentColors,
  AGENT_COLORS,
  type AgentBadgeProps,
} from './components/AgentBadge.js';
export {
  AgentSwitcher,
  AgentStatusBar,
  type AgentSwitcherProps,
  type AgentStatusBarProps,
  type AgentInfo,
} from './components/AgentSwitcher.js';
export {
  ToolApprovalDialog,
  type ToolApprovalDialogProps,
} from './components/ToolApprovalDialog.js';
export {
  ToolApprovalContainer,
  PendingApprovalBadge,
  type ToolApprovalContainerProps,
  type PendingApprovalBadgeProps,
} from './components/ToolApprovalContainer.js';
export { HandoffIndicator, type HandoffIndicatorProps } from './components/HandoffIndicator.js';
export {
  ActionConfirmDialog,
  ActionConfirmContainer,
  type ActionConfirmDialogProps,
  type ActionConfirmContainerProps,
} from './components/ActionConfirmDialog.js';

// Theme
export {
  AgentUIProvider,
  useAgentUITheme,
  useDisplayConfig,
  getDefaultTheme,
  type AgentUIProviderProps,
  type AgentUITheme,
  type DisplayConfig,
  type ToolDisplayMode,
  type ToolDisplayOptions,
  type ResolvedDisplayConfig,
  type ResolvedToolDisplayOptions,
} from './theme/AgentUIProvider.js';

// Primitives
export { Button, buttonVariants, type ButtonProps } from './primitives/Button.js';
export { Textarea, type TextareaProps } from './primitives/Textarea.js';
