import React, { createContext, useContext } from 'react';

/**
 * @description
 * Tool display mode presets for white-label configuration.
 *
 * Controls the visibility and verbosity of tool execution feedback in the chat interface.
 *
 * @docsCategory ui-theme
 */
export type ToolDisplayMode = 'full' | 'minimal' | 'hidden';

/**
 * @description
 * Fine-grained tool display configuration options.
 *
 * These override the preset {@link ToolDisplayMode} when specified, allowing granular control
 * over individual aspects of tool call rendering.
 *
 * @docsCategory ui-theme
 */
export interface ToolDisplayOptions {
  showToolName?: boolean;
  showToolState?: boolean;
  showToolArgs?: boolean;
  showToolResult?: boolean;
  showActivityIndicator?: boolean;
}

/**
 * @description
 * Resolved tool display options used internally by components.
 *
 * All optional fields from {@link ToolDisplayOptions} are resolved to concrete boolean values.
 *
 * @docsCategory ui-theme
 */
export interface ResolvedToolDisplayOptions {
  showToolName: boolean;
  showToolState: boolean;
  showToolArgs: boolean;
  showToolResult: boolean;
  showActivityIndicator: boolean;
}

/**
 * @description
 * Display configuration for white-label customization of the chat interface.
 *
 * Provides control over tool execution visibility and streaming indicator behavior.
 * Used by {@link AgentUIProvider} to configure the visual presentation of agent activity.
 *
 * @docsCategory ui-theme
 */
export interface DisplayConfig {
  toolDisplayMode?: ToolDisplayMode;
  toolDisplayOptions?: ToolDisplayOptions;
  streamingIndicatorText?: string;
  hideStreamingIndicator?: boolean;
}

/**
 * @description
 * Resolved display configuration used internally by components.
 *
 * All optional fields are resolved to concrete values based on defaults and provided overrides.
 *
 * @docsCategory ui-theme
 */
export interface ResolvedDisplayConfig {
  toolDisplay: ResolvedToolDisplayOptions;
  streamingIndicatorText?: string;
  hideStreamingIndicator: boolean;
}

const TOOL_DISPLAY_MODE_DEFAULTS: Record<ToolDisplayMode, ResolvedToolDisplayOptions> = {
  full: {
    showToolName: true,
    showToolState: true,
    showToolArgs: true,
    showToolResult: true,
    showActivityIndicator: false,
  },
  minimal: {
    showToolName: true,
    showToolState: false,
    showToolArgs: false,
    showToolResult: false,
    showActivityIndicator: true,
  },
  hidden: {
    showToolName: false,
    showToolState: false,
    showToolArgs: false,
    showToolResult: false,
    showActivityIndicator: false,
  },
};

function resolveDisplayConfig(config?: DisplayConfig): ResolvedDisplayConfig {
  const mode = config?.toolDisplayMode ?? 'full';
  const modeDefaults = TOOL_DISPLAY_MODE_DEFAULTS[mode];

  return {
    toolDisplay: {
      ...modeDefaults,
      ...config?.toolDisplayOptions,
    },
    streamingIndicatorText: config?.streamingIndicatorText,
    hideStreamingIndicator: config?.hideStreamingIndicator ?? false,
  };
}

const defaultDisplayConfig: ResolvedDisplayConfig = resolveDisplayConfig();

/**
 * @description
 * Theme configuration for Hexos UI components.
 *
 * Defines the visual styling system including colors, spacing, border radius, and fonts.
 * Passed to {@link AgentUIProvider} for application-wide styling.
 *
 * @docsCategory ui-theme
 */
export interface AgentUITheme {
  colors: {
    userBubble: string;
    userBubbleText: string;
    assistantBubble: string;
    assistantBubbleText: string;
    toolCall: string;
    toolCallText: string;
    reasoning: string;
    reasoningText: string;
    error: string;
    errorText: string;
    border: string;
    background: string;
    text: string;
    textMuted: string;
    primary: string;
    primaryText: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  fonts: {
    body: string;
    mono: string;
  };
}

const defaultTheme: AgentUITheme = {
  colors: {
    userBubble: '#3b82f6',
    userBubbleText: '#ffffff',
    assistantBubble: '#f3f4f6',
    assistantBubbleText: '#1f2937',
    toolCall: '#fef3c7',
    toolCallText: '#92400e',
    reasoning: '#f9fafb',
    reasoningText: '#6b7280',
    error: '#fef2f2',
    errorText: '#dc2626',
    border: '#e5e7eb',
    background: '#ffffff',
    text: '#1f2937',
    textMuted: '#6b7280',
    primary: '#3b82f6',
    primaryText: '#ffffff',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.5rem',
    lg: '1rem',
    full: '9999px',
  },
  fonts: {
    body: 'system-ui, -apple-system, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, monospace',
  },
};

const ThemeContext = createContext<AgentUITheme>(defaultTheme);
const DisplayConfigContext = createContext<ResolvedDisplayConfig>(defaultDisplayConfig);

/**
 * @description
 * Props for the {@link AgentUIProvider} component.
 *
 * @docsCategory ui-theme
 */
export interface AgentUIProviderProps {
  theme?: Partial<AgentUITheme>;
  /** Display configuration for white-label customization */
  displayConfig?: DisplayConfig;
  children: React.ReactNode;
}

/**
 * @description
 * Theme and display configuration provider for Hexos UI components.
 *
 * Wraps the application to provide centralized theming and display configuration via React Context.
 * Supports partial theme overrides that merge with defaults, and display configuration for
 * white-labeling tool visibility and streaming indicators.
 *
 * All child Hexos UI components access theme and display settings via {@link useAgentUITheme}
 * and {@link useDisplayConfig} hooks.
 *
 * @example
 * ```tsx
 * <AgentUIProvider
 *   theme={{
 *     colors: {
 *       userBubble: '#8b5cf6',
 *       primary: '#8b5cf6',
 *     },
 *   }}
 *   displayConfig={{
 *     toolDisplayMode: 'hidden',
 *   }}
 * >
 *   <ChatWindow />
 * </AgentUIProvider>
 * ```
 *
 * @docsCategory ui-theme
 */
export function AgentUIProvider({
  theme,
  displayConfig,
  children,
}: AgentUIProviderProps): React.ReactElement {
  const mergedTheme: AgentUITheme = {
    ...defaultTheme,
    ...theme,
    colors: { ...defaultTheme.colors, ...theme?.colors },
    spacing: { ...defaultTheme.spacing, ...theme?.spacing },
    borderRadius: { ...defaultTheme.borderRadius, ...theme?.borderRadius },
    fonts: { ...defaultTheme.fonts, ...theme?.fonts },
  };

  const resolvedDisplayConfig = resolveDisplayConfig(displayConfig);

  return (
    <ThemeContext.Provider value={mergedTheme}>
      <DisplayConfigContext.Provider value={resolvedDisplayConfig}>
        {children}
      </DisplayConfigContext.Provider>
    </ThemeContext.Provider>
  );
}

/**
 * @description
 * Hook to access the current theme configuration.
 *
 * Must be called within a component tree wrapped by {@link AgentUIProvider}.
 * Returns the merged theme with any custom overrides applied.
 *
 * @returns The current {@link AgentUITheme} configuration
 *
 * @docsCategory ui-theme
 */
export function useAgentUITheme(): AgentUITheme {
  return useContext(ThemeContext);
}

/**
 * @description
 * Hook to access the current display configuration.
 *
 * Must be called within a component tree wrapped by {@link AgentUIProvider}.
 * Returns the resolved display configuration with all defaults applied.
 *
 * @returns The current {@link ResolvedDisplayConfig}
 *
 * @docsCategory ui-theme
 */
export function useDisplayConfig(): ResolvedDisplayConfig {
  return useContext(DisplayConfigContext);
}

/**
 * @description
 * Returns a copy of the default theme configuration.
 *
 * Useful for programmatically building custom themes or inspecting default values.
 *
 * @returns The default {@link AgentUITheme}
 *
 * @docsCategory ui-theme
 */
export function getDefaultTheme(): AgentUITheme {
  return defaultTheme;
}
