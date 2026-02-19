import { z } from "zod";
import { AgentRuntime, LLMProvider, OpenAIModel } from "@hexos/runtime";
import {
  buildDocsIndex,
  getDocByPath,
  searchDocs,
  truncateContent,
} from "@/docs/lib/docs-index";

let runtimeInstance: AgentRuntime | null = null;

// Pre-build the index at module load time so it's ready before any request
buildDocsIndex();

/**
 * Build dynamic system prompt with current page content injected.
 */
function buildSystemPrompt(context: unknown): string {
  // Get the current page being viewed from frontend context
  const pageContext = (context as Record<string, unknown>)?.frontendContext?.["docs.page-context"] as
    | { asPath: string; pathname: string; section: string; page: string }
    | undefined;

  const currentPageBlock = pageContext?.asPath ? buildCurrentPageBlock(pageContext.asPath) : "";

  return `You are the Hexos documentation assistant. Hexos is a React library for building AI agent chat applications.

Your goals:
- Answer questions accurately based on the Hexos documentation.
- Give practical, copy-paste-ready guidance when useful.
- When you don't know something, use the search_docs tool before saying you don't know.
- Prefer the content from the current page the user is viewing when it is relevant.

Behavior rules:
- Be concise and direct.
- When citing API shapes or types, quote them exactly as they appear in the docs.
- If the user asks about something not covered in the docs, say so clearly.
- Use the search_docs tool to find information about topics not covered by the current page.
${currentPageBlock}`;
}

/**
 * Inject the current page content into the system prompt.
 */
function buildCurrentPageBlock(path: string): string {
  const entry = getDocByPath(path);
  if (!entry) return "";

  const content = truncateContent(entry.content, 4000);
  return `

---
CURRENT PAGE: "${entry.title}" (path: /docs/${entry.slug})

${content}
---`;
}

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
        systemPrompt: buildSystemPrompt,
        tools: [
          {
            name: "search_docs",
            description:
              "Search the Hexos documentation by keyword or topic. Returns the most relevant pages with their content. Use this when the user asks about something not covered by the current page.",
            inputSchema: z.object({
              query: z
                .string()
                .describe(
                  "Search terms, e.g. 'useAgent hook', 'tool approval', 'MCP server configuration'"
                ),
              topN: z
                .number()
                .int()
                .min(1)
                .max(8)
                .optional()
                .describe("Number of results to return (default 5)"),
            }),
            execute: async (input) => {
              const { query, topN } = input as { query: string; topN?: number };
              const results = searchDocs(query, topN ?? 5);

              if (results.length === 0) {
                return {
                  found: false,
                  message: `No documentation pages found matching "${query}".`,
                  results: [],
                };
              }

              return {
                found: true,
                results: results.map((entry) => ({
                  slug: entry.slug,
                  title: entry.title,
                  section: entry.section,
                  url: `/docs/${entry.slug}`,
                  content: truncateContent(entry.content, 3000),
                })),
              };
            },
          },
          {
            name: "get_page_content",
            description:
              "Retrieve the full content of a specific documentation page by its slug path (e.g. 'react-core/hooks/use-agent'). Use this when you know the exact page you need.",
            inputSchema: z.object({
              slug: z
                .string()
                .describe(
                  "The page slug relative to /docs/, e.g. 'runtime/agent-runtime' or 'common/core-types/agent-message'"
                ),
            }),
            execute: async (input) => {
              const { slug } = input as { slug: string };
              const index = buildDocsIndex();
              const entry = index.get(slug);

              if (!entry) {
                // Try a fuzzy fallback: find slugs that contain the query
                const candidates = Array.from(index.keys())
                  .filter((k) => k.includes(slug))
                  .slice(0, 3);

                return {
                  found: false,
                  message: `Page "${slug}" not found in documentation.`,
                  suggestions: candidates.length > 0 ? candidates : undefined,
                };
              }

              return {
                found: true,
                slug: entry.slug,
                title: entry.title,
                section: entry.section,
                url: `/docs/${entry.slug}`,
                content: truncateContent(entry.content, 6000),
              };
            },
          },
        ],
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
