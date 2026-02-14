import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { RunnableConfig } from '@langchain/core/runnables';
import type { AgentStateType } from './state.js';
import type { AgentDefinition, ToolDefinition, RuntimeEvent } from '../types.js';

/**
 * Creates the router node that determines which agent handles the request.
 */
export function createRouterNode(agents: Map<string, AgentDefinition>, defaultAgent: string) {
  return async (state: AgentStateType, config?: RunnableConfig): Promise<Partial<AgentStateType>> => {
    // For now, use the current active agent or default
    // In the future, this could use an LLM to route based on the message content
    const activeAgent = state.activeAgent || defaultAgent;

    if (!agents.has(activeAgent)) {
      return {
        error: `Agent "${activeAgent}" not found`,
        activeAgent: defaultAgent,
      };
    }

    return {
      activeAgent,
    };
  };
}

/**
 * Creates an agent node that processes messages using the configured LLM.
 */
export function createAgentNode(agent: AgentDefinition, allAgents: Map<string, AgentDefinition>) {
  return async (state: AgentStateType, config?: RunnableConfig): Promise<Partial<AgentStateType>> => {
    // Build system prompt
    const systemPrompt = typeof agent.systemPrompt === 'function'
      ? agent.systemPrompt({
          conversationId: state.conversationId,
          userId: state.userId ?? undefined,
          frontendContext: state.frontendContext,
        })
      : agent.systemPrompt;

    // Add handoff tools if agent can delegate
    const tools = [...agent.tools];
    if (agent.canHandoffTo && agent.canHandoffTo.length > 0) {
      for (const targetId of agent.canHandoffTo) {
        const targetAgent = allAgents.get(targetId);
        if (targetAgent) {
          tools.push(createHandoffTool(targetId, targetAgent.description));
        }
      }
    }

    // For now, return a placeholder response
    // The actual LLM integration will be added with provider adapters
    const responseMessage = new AIMessage({
      content: `[Agent ${agent.id}] Processing your request...`,
      additional_kwargs: {
        agentId: agent.id,
      },
    });

    return {
      messages: [responseMessage],
    };
  };
}

/**
 * Creates the tool executor node that runs tool calls.
 */
export function createToolExecutorNode(
  agents: Map<string, AgentDefinition>,
  globalTools: ToolDefinition[] = []
) {
  return async (state: AgentStateType, config?: RunnableConfig): Promise<Partial<AgentStateType>> => {
    const lastMessage = state.messages[state.messages.length - 1];

    // Check if the last message has tool calls
    if (!lastMessage || !(lastMessage instanceof AIMessage)) {
      return {};
    }

    const toolCalls = lastMessage.additional_kwargs?.tool_calls;
    if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
      return {};
    }

    // Get available tools for the active agent
    const activeAgent = agents.get(state.activeAgent);
    const availableTools = [
      ...globalTools,
      ...(activeAgent?.tools ?? []),
    ];

    const toolResults: Array<{ role: 'tool'; content: string; tool_call_id: string }> = [];

    for (const toolCall of toolCalls) {
      const tool = availableTools.find(t => t.name === toolCall.function.name);

      if (!tool) {
        toolResults.push({
          role: 'tool',
          content: JSON.stringify({ error: `Tool "${toolCall.function.name}" not found` }),
          tool_call_id: toolCall.id,
        });
        continue;
      }

      try {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await tool.execute(args, {
          agentId: state.activeAgent,
          conversationId: state.conversationId,
          userId: state.userId ?? undefined,
        });

        toolResults.push({
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: toolCall.id,
        });
      } catch (error) {
        toolResults.push({
          role: 'tool',
          content: JSON.stringify({ error: String(error) }),
          tool_call_id: toolCall.id,
        });
      }
    }

    // Tool messages will be added in a future iteration
    return {};
  };
}

/**
 * Creates the approval gate node for human-in-the-loop.
 */
export function createApprovalGateNode() {
  return async (state: AgentStateType, config?: RunnableConfig): Promise<Partial<AgentStateType>> => {
    // If there are pending approvals, the graph will interrupt
    // This is handled by the compile configuration
    return {};
  };
}

/**
 * Creates the response formatter node.
 */
export function createResponseFormatterNode() {
  return async (state: AgentStateType, config?: RunnableConfig): Promise<Partial<AgentStateType>> => {
    const lastMessage = state.messages[state.messages.length - 1];

    if (lastMessage instanceof AIMessage) {
      return {
        finalResponse: lastMessage.content as string,
      };
    }

    return {
      finalResponse: '',
    };
  };
}

/**
 * Creates a handoff tool for the swarm pattern.
 */
function createHandoffTool(targetAgentId: string, targetDescription: string): ToolDefinition {
  const { z } = require('zod');

  return {
    name: `handoff_to_${targetAgentId}`,
    description: `Transfer the conversation to ${targetAgentId}. ${targetDescription}`,
    inputSchema: z.object({
      reason: z.string().describe('Why you are handing off to this agent'),
      context: z.string().optional().describe('Additional context for the target agent'),
    }),
    execute: async (input: { reason: string; context?: string }) => {
      // The handoff is handled by the edge routing, not the tool execution
      return {
        handoff: true,
        targetAgent: targetAgentId,
        reason: input.reason,
      };
    },
  };
}

/**
 * Routing function for after an agent node executes.
 */
export function createAgentRouter(agent: AgentDefinition) {
  return (state: AgentStateType): string => {
    const lastMessage = state.messages[state.messages.length - 1];

    // Check for tool calls
    if (lastMessage instanceof AIMessage) {
      const toolCalls = lastMessage.additional_kwargs?.tool_calls;

      if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
        // Check if any tool requires approval
        const requiresApproval = toolCalls.some(tc => {
          const tool = agent.tools.find(t => t.name === tc.function.name);
          return tool?.requiresApproval;
        });

        if (requiresApproval) {
          return 'approval_gate';
        }

        // Check if it's a handoff
        const handoffCall = toolCalls.find(tc => tc.function.name.startsWith('handoff_to_'));
        if (handoffCall) {
          return 'router';
        }

        return 'tool_executor';
      }
    }

    // Check max iterations
    if (state.iterationCount >= (agent.maxIterations ?? 10)) {
      return 'response';
    }

    // Default: format response
    return 'response';
  };
}
