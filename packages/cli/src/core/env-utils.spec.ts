import { describe, expect, it } from 'vitest';

import { mergeEnvContent } from './env-utils';

describe('env-utils', () => {
    it('appends missing keys and keeps existing values', () => {
        const existing = 'OPENAI_API_KEY=already-set\n';
        const incoming = 'OPENAI_API_KEY=new\nANTHROPIC_API_KEY=abc\n';

        const result = mergeEnvContent(existing, incoming);

        expect(result).toContain('OPENAI_API_KEY=already-set');
        expect(result).toContain('ANTHROPIC_API_KEY=abc');
        expect(result).not.toContain('OPENAI_API_KEY=new');
    });
});
