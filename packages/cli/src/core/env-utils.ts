const ENV_KEY_PATTERN = /^\s*([A-Za-z_][A-Za-z0-9_]*)=/;

export function mergeEnvContent(existingContent: string | null, incomingContent: string): string {
    if (!existingContent || existingContent.trim().length === 0) {
        return ensureTrailingNewline(incomingContent);
    }

    const existingLines = existingContent.split(/\r?\n/);
    const existingKeys = new Set<string>();

    for (const line of existingLines) {
        const match = line.match(ENV_KEY_PATTERN);
        if (match) {
            existingKeys.add(match[1]);
        }
    }

    const linesToAppend: string[] = [];
    for (const line of incomingContent.split(/\r?\n/)) {
        const match = line.match(ENV_KEY_PATTERN);
        if (!match) {
            continue;
        }
        if (!existingKeys.has(match[1])) {
            linesToAppend.push(line);
        }
    }

    const trimmedExisting = ensureTrailingNewline(existingContent).trimEnd();

    if (linesToAppend.length === 0) {
        return `${trimmedExisting}\n`;
    }

    return `${trimmedExisting}\n${linesToAppend.join('\n')}\n`;
}

function ensureTrailingNewline(content: string): string {
    return content.endsWith('\n') ? content : `${content}\n`;
}
