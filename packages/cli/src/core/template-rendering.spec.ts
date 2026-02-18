import { describe, expect, it } from 'vitest';

import { generateInstallFiles } from './template-rendering';
import { InstallConfig } from '../types';

describe('template-rendering', () => {
    it('always includes chat route layout with react-ui styles import', async () => {
        const installConfig: InstallConfig = {
            provider: 'anthropic',
            apiKey: '',
            ollamaHost: 'http://localhost:11434',
            includeMcpDashboard: false,
            includeExampleTools: true,
            agentMode: 'single',
            chatRoute: 'chat',
        };

        const files = await generateInstallFiles({
            projectName: 'test-app',
            installConfig,
        });

        const layoutFile = files.find(file => file.relativePath === 'app/chat/layout.tsx');
        const mcpCssFile = files.find(file => file.relativePath === 'app/chat/hexos.css');

        expect(layoutFile).toBeDefined();
        expect(layoutFile?.content).toContain("@hexos/react-ui/styles.css");
        expect(layoutFile?.content).not.toContain("./hexos.css");
        expect(mcpCssFile).toBeUndefined();
    });

    it('includes route-level MCP css and imports it in layout when mcp dashboard is enabled', async () => {
        const installConfig: InstallConfig = {
            provider: 'openai',
            apiKey: '',
            ollamaHost: 'http://localhost:11434',
            includeMcpDashboard: true,
            includeExampleTools: true,
            agentMode: 'single',
            chatRoute: 'chat',
        };

        const files = await generateInstallFiles({
            projectName: 'test-app',
            installConfig,
        });

        const layoutFile = files.find(file => file.relativePath === 'app/chat/layout.tsx');
        const mcpCssFile = files.find(file => file.relativePath === 'app/chat/hexos.css');

        expect(layoutFile).toBeDefined();
        expect(layoutFile?.content).toContain("./hexos.css");
        expect(mcpCssFile).toBeDefined();
        expect(mcpCssFile?.content).toContain('.mcp-page');
    });
});
