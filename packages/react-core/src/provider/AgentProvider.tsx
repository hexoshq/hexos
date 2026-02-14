import React, { useEffect } from 'react';
import { Provider, useSetAtom } from 'jotai';
import { agentConfigAtom, conversationIdAtom } from '../atoms/index.js';
import type { AgentConfig } from '../types.js';

/**
 * @description
 * Props for the {@link AgentProvider} component.
 *
 * @docsCategory hooks
 */
export interface AgentProviderProps {
  children: React.ReactNode;
  config: AgentConfig;
}

function AgentConfigSetter({ config }: { config: AgentConfig }) {
  const setConfig = useSetAtom(agentConfigAtom);
  const setConversationId = useSetAtom(conversationIdAtom);

  useEffect(() => {
    setConfig(config);
    if (config.conversationId) {
      setConversationId(config.conversationId);
    }
  }, [config, setConfig, setConversationId]);

  return null;
}

/**
 * @description
 * Provider component that initializes the Jotai atom store and sets up agent configuration.
 *
 * Creates an isolated Jotai {@link Provider} scope so that multiple AgentProvider instances
 * on the same page maintain independent state. Internally uses `AgentConfigSetter` to
 * hydrate {@link agentConfigAtom} and {@link conversationIdAtom} from the provided config.
 *
 * Wrap your chat UI or application root with this provider to enable all Hexos hooks.
 *
 * Related: {@link useAgent} reads the config from atoms, {@link AgentConfig} defines
 * connection options, {@link ChatWindow} is typically a direct child.
 *
 * @param props - Provider props including children and agent configuration
 * @returns React element wrapping children in the Jotai provider
 *
 * @example
 * ```tsx
 * <AgentProvider config={{
 *   endpoint: '/api/agent/chat',
 *   agents: ['main', 'code', 'research'],
 *   transport: 'sse',
 * }}>
 *   <ChatInterface />
 * </AgentProvider>
 * ```
 *
 * @docsCategory hooks
 */
export function AgentProvider({ children, config }: AgentProviderProps): React.ReactElement {
  return (
    <Provider>
      <AgentConfigSetter config={config} />
      {children}
    </Provider>
  );
}
