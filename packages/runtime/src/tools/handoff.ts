import { z } from 'zod';
import type {
  ToolDefinition,
  AgentDefinition,
  HandoffResult,
  HandoffToolInput,
} from '@hexos/common';

/**
 * @description
 * Zod schema for handoff tool input validation.
 *
 * Requires a `reason` string explaining why the conversation is being transferred,
 * and an optional `context` string with additional information for the target agent.
 * Used by tools generated via {@link generateHandoffTools}.
 *
 * @docsCategory tools
 */
export const handoffInputSchema = z.object({
  reason: z.string().describe('Explain why you are transferring to this agent'),
  context: z.string().optional().describe('Additional context to pass to the target agent'),
});

/**
 * @description
 * Auto-generates handoff tools for an agent based on its `canHandoffTo` configuration.
 *
 * For each target agent ID listed in `canHandoffTo`, creates a {@link ToolDefinition} named
 * `handoff_to_<targetId>` that returns a {@link HandoffResult} when executed. The LLM uses
 * these tools to route conversations to specialized agents in the multi-agent swarm pattern.
 *
 * Only generates tools for target agents that exist in the `allAgents` registry. The tool
 * description includes the target agent's name and description to help the LLM make
 * informed routing decisions.
 *
 * Related: {@link AgentRuntime} calls this in `getAgentTools()`, {@link isHandoffResult}
 * detects the returned marker, {@link HandoffResult} is the tool output type.
 *
 * @param agent - The agent to generate handoff tools for
 * @param allAgents - Registry of all available agents
 * @returns Array of handoff tool definitions (empty if no canHandoffTo targets)
 *
 * @docsCategory tools
 */
export function generateHandoffTools(
  agent: AgentDefinition,
  allAgents: Map<string, AgentDefinition>
): ToolDefinition[] {
  if (!agent.canHandoffTo?.length) {
    return [];
  }

  return agent.canHandoffTo
    .filter((targetId) => allAgents.has(targetId))
    .map((targetId) => {
      const targetAgent = allAgents.get(targetId)!;

      const tool: ToolDefinition = {
        name: `handoff_to_${targetId}`,
        description: `Transfer the conversation to ${targetAgent.name}. ${targetAgent.description}`,
        inputSchema: handoffInputSchema,
        execute: async (input: unknown): Promise<HandoffResult> => {
          const { reason, context } = input as HandoffToolInput;
          return {
            __handoff: true,
            targetAgent: targetId,
            reason,
            context,
          };
        },
      };

      return tool;
    });
}

/**
 * @description
 * Checks whether a tool name follows the handoff naming convention (`handoff_to_<agentId>`).
 *
 * @param toolName - Tool name to check
 * @returns True if the name starts with `handoff_to_`
 *
 * @docsCategory tools
 */
export function isHandoffTool(toolName: string): boolean {
  return toolName.startsWith('handoff_to_');
}

/**
 * @description
 * Extracts the target agent ID from a handoff tool name.
 *
 * Strips the `handoff_to_` prefix to recover the original agent ID.
 * Returns null if the tool name is not a handoff tool.
 *
 * @param toolName - Tool name to parse
 * @returns The target agent ID, or null if not a handoff tool
 *
 * @docsCategory tools
 */
export function getHandoffTargetFromToolName(toolName: string): string | null {
  if (!isHandoffTool(toolName)) {
    return null;
  }
  return toolName.replace('handoff_to_', '');
}
