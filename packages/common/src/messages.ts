/**
 * @description
 * Discriminator for message authorship in a conversation.
 *
 * Used by {@link AgentMessage} to identify who produced a message:
 * `user` for human input, `assistant` for LLM responses, `system` for
 * system prompts, and `tool` for tool execution results.
 *
 * @docsCategory core-types
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * @description
 * Tracks a single tool invocation from the LLM, including its lifecycle state and result.
 *
 * Created when the LLM requests tool execution. The `status` field tracks the call through
 * its lifecycle: `pending` → `running` → `completed` or `error`. Results and errors are
 * populated once execution finishes.
 *
 * Related: {@link ToolDefinition} defines the callable tool, {@link RuntimeEvent} streams
 * tool call progress, {@link ToolCallRenderer} displays execution in the UI.
 *
 * @docsCategory tools
 */
export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
  error?: string;
}

/**
 * @description
 * File or media attachment associated with a message.
 *
 * Supports image, file, and audio types. The `data` field contains the content
 * as a base64 string or data URI. Attachments are sent with user messages via
 * {@link TransportMessage} and stored in {@link AgentMessage}.
 *
 * @docsCategory core-types
 */
export interface Attachment {
  type: 'image' | 'file' | 'audio';
  name: string;
  data: string;
  mimeType: string;
}

/**
 * @description
 * Represents a single message in a conversation, with role, content, and optional structured data.
 *
 * Messages are the primary data unit in the chat flow. User messages contain plain text input,
 * while assistant messages may include tool calls and their results. Each message is timestamped
 * and optionally tagged with the agent that produced it for multi-agent conversations.
 *
 * Related: {@link MessageRole} discriminates authorship, {@link ToolCall} tracks tool invocations,
 * {@link Attachment} holds file/media data.
 *
 * @docsCategory core-types
 */
export interface AgentMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
  agentId?: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
}
