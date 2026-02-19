import { AgentRuntime, LLMProvider, OpenAIModel } from "@hexos/runtime";

let runtimeInstance: AgentRuntime | null = null;

function createDocsRuntime(): AgentRuntime {
  return new AgentRuntime({
    agents: [
      {
        id: "docs-assistant",
        name: "Hexos Docs Assistant",
        description:
          "Assists users with Hexos documentation, setup guidance, and API usage.",
        model: {
          provider: LLMProvider.OpenAI,
          model: OpenAIModel.GPT4oMini,
        },
        systemPrompt: `You are the Hexos documentation assistant.

Your goals:
- Help users understand and use Hexos quickly.
- Give practical, copy-paste-ready guidance when useful.
- Prioritize answers grounded in documented Hexos concepts.
- Use the provided frontend context (current docs page/path) to tailor the answer.

Behavior rules:
- Be concise, accurate, and direct.
- If information is uncertain, say so clearly.
- When appropriate, point users to the relevant section they are currently viewing.`,
        tools: [],
      },
    ],
    defaultAgent: "docs-assistant",
    debug: process.env.NODE_ENV === "development",
  });
}

export async function getDocsRuntime(): Promise<AgentRuntime> {
  if (!runtimeInstance) {
    runtimeInstance = createDocsRuntime();
  }

  return runtimeInstance;
}
