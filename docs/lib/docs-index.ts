import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface DocEntry {
  slug: string;
  title: string;
  section: string;
  content: string;
  rawSize: number;
}

const DOCS_ROOT = join(process.cwd(), "pages/docs");

/**
 * Strip MDX syntax to extract plain text content.
 * Preserves markdown structure (headings, code blocks, prose).
 * Removes: frontmatter, imports, JSX components.
 */
function stripMdx(raw: string): string {
  let text = raw;

  // 1. Remove YAML frontmatter block (---...---)
  text = text.replace(/^---[\s\S]*?---\n?/, "");

  // 2. Remove import statements (e.g., import { Foo } from '@/...')
  text = text.replace(/^import\s+.*?from\s+['"][^'"]+['"]\s*;?\s*$/gm, "");

  // 3. Remove JSX self-closing tags with uppercase names
  // (e.g., <GenerationInfo ... />, <MemberInfo ... />)
  text = text.replace(/<[A-Z][^>]*\/>/g, "");

  // 4. Remove JSX block elements with uppercase names
  // (e.g., <div>, <section>, but only uppercase component names)
  text = text.replace(/<[A-Z][A-Za-z]*[^>]*>[\s\S]*?<\/[A-Z][A-Za-z]*>/g, "");

  // 5. Remove remaining lowercase HTML self-closing tags
  text = text.replace(/<[a-z]+[^>]*\/>/g, "");

  // 6. Collapse multiple blank lines into two
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Extract title from frontmatter or derive from slug.
 */
function extractTitle(raw: string, slug: string): string {
  const match = raw.match(/^---[\s\S]*?title:\s*["']?([^"'\n]+)["']?/m);
  if (match) {
    return match[1].trim();
  }

  // Fallback: derive from slug
  const last = slug.split("/").pop() ?? slug;
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Recursively collect all .mdx files from a directory.
 */
function collectMdxFiles(dir: string, files: string[] = []): string[] {
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        collectMdxFiles(full, files);
      } else if (entry.endsWith(".mdx")) {
        files.push(full);
      }
    }
  } catch {
    // Silently skip directories we can't read
  }
  return files;
}

let cachedIndex: Map<string, DocEntry> | null = null;

/**
 * Build and cache the documentation index.
 * Scans all .mdx files in pages/docs/, strips content, and indexes by slug.
 * This runs once and is cached for the lifetime of the process.
 */
export function buildDocsIndex(): Map<string, DocEntry> {
  if (cachedIndex) {
    return cachedIndex;
  }

  const index = new Map<string, DocEntry>();

  try {
    const files = collectMdxFiles(DOCS_ROOT);

    for (const filePath of files) {
      const raw = readFileSync(filePath, "utf-8");

      // Convert file path to slug: pages/docs/react-core/hooks/use-agent.mdx -> react-core/hooks/use-agent
      const rel = relative(DOCS_ROOT, filePath).replace(/\\/g, "/").replace(/\.mdx$/, "");
      const slug = rel;
      const section = slug.split("/")[0] ?? "docs";
      const title = extractTitle(raw, slug);
      const content = stripMdx(raw);

      index.set(slug, {
        slug,
        title,
        section,
        content,
        rawSize: raw.length,
      });
    }
  } catch (error) {
    // If index building fails, return empty index to prevent runtime errors
    console.error("Failed to build docs index:", error);
  }

  cachedIndex = index;
  return index;
}

/**
 * Convert a URL path like "/docs/react-core/hooks/use-agent" to a slug.
 */
export function pathToSlug(path: string): string {
  return path.replace(/^\/docs\//, "").replace(/\/$/, "");
}

/**
 * Retrieve a documentation entry by its URL path.
 */
export function getDocByPath(path: string): DocEntry | undefined {
  const index = buildDocsIndex();
  const slug = pathToSlug(path);
  return index.get(slug);
}

/**
 * Search documentation by keyword/query.
 * Returns top N results sorted by relevance score.
 * Title matches score 3x higher than body matches.
 */
export function searchDocs(query: string, topN = 5): DocEntry[] {
  const index = buildDocsIndex();

  if (!query || query.trim().length === 0) {
    return [];
  }

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  const scored: Array<{ entry: DocEntry; score: number }> = [];

  for (const entry of index.values()) {
    const titleLower = entry.title.toLowerCase();
    const slugLower = entry.slug.toLowerCase();
    const contentLower = entry.content.toLowerCase();
    const haystack = `${titleLower} ${slugLower} ${contentLower}`;

    let score = 0;

    for (const term of terms) {
      // Count occurrences in title (weight 3x)
      const titleMatches = (titleLower.match(new RegExp(term, "g")) ?? []).length;
      // Count occurrences in slug (weight 2x)
      const slugMatches = (slugLower.match(new RegExp(term, "g")) ?? []).length;
      // Count occurrences in body (weight 1x)
      const bodyMatches = (haystack.match(new RegExp(term, "g")) ?? []).length - titleMatches - slugMatches;

      score += titleMatches * 3 + slugMatches * 2 + bodyMatches;
    }

    if (score > 0) {
      scored.push({ entry, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.entry);
}

/**
 * Truncate content to a maximum character length.
 */
export function truncateContent(content: string, maxChars = 3000): string {
  if (content.length <= maxChars) {
    return content;
  }
  return content.slice(0, maxChars) + "\n\n[... content truncated ...]";
}
