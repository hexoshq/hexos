import * as Collapsible from '@radix-ui/react-collapsible';

import React, { useState } from 'react';

/**
 * @description
 * Props for the {@link ReasoningDisplay} component.
 *
 * @docsCategory ui-components
 */
export interface ReasoningDisplayProps {
  content: string;
  isStreaming?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

/**
 * @description
 * Collapsible display for agent reasoning and thinking content.
 *
 * Uses Radix UI Collapsible for accessible expand/collapse behavior with keyboard support
 * and ARIA attributes. Shows agent internal reasoning as a toggleable section.
 *
 * Automatically expands during streaming to provide real-time visibility into agent thought process,
 * then collapses by default once streaming completes. The header displays an estimated thinking
 * duration based on content length (1 second per 100 characters).
 *
 * Visual feedback includes a rotating arrow indicator and an animated spinner during streaming,
 * plus a blinking cursor at the end of streaming content.
 *
 * @example
 * ```tsx
 * <ReasoningDisplay
 *   content="Analyzing the user's request..."
 *   isStreaming={true}
 *   defaultCollapsed={false}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function ReasoningDisplay({
  content,
  isStreaming = false,
  defaultCollapsed = true,
  className = '',
}: ReasoningDisplayProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(!defaultCollapsed || isStreaming);

  // Estimate thinking duration based on content length
  const estimatedSeconds = Math.ceil(content.length / 100);

  return (
    <Collapsible.Root
      open={isOpen}
      onOpenChange={setIsOpen}
      className={`hexos-reasoning ${className} ax-mb-2 ax-bg-gray-50 ax-rounded-lg ax-border ax-border-gray-200 ax-overflow-hidden`}
    >
      <Collapsible.Trigger className="ax-flex ax-items-center ax-gap-2 ax-w-full ax-py-3 ax-px-4 ax-cursor-pointer ax-select-none ax-text-sm ax-text-gray-600 ax-font-medium ax-bg-transparent ax-border-0">
        <span
          className="ax-inline-block ax-transition-transform ax-duration-200"
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▶
        </span>
        <span>
          {isStreaming ? 'Thinking...' : `Thought for ${estimatedSeconds}s`}
        </span>
        {isStreaming && (
          <span className="ax-inline-block ax-w-3 ax-h-3 ax-rounded-full ax-border-2 ax-border-gray-200 ax-border-t-blue-500 ax-animate-hexos-spin" />
        )}
      </Collapsible.Trigger>

      <Collapsible.Content className="ax-px-4 ax-pb-3 ax-text-sm ax-text-gray-500 ax-whitespace-pre-wrap ax-leading-relaxed">
        {content}
        {isStreaming && (
          <span className="ax-inline-block ax-w-2 ax-h-4 ax-bg-gray-500 ax-ml-0.5 ax-animate-hexos-blink" />
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
