import React from 'react';
import { Button } from '../primitives/Button.js';

/**
 * @description
 * Props for the {@link QuickReplies} component.
 *
 * @docsCategory ui-components
 */
export interface QuickRepliesProps {
  /** List of suggestion strings to display */
  suggestions: string[];
  /** Callback when a suggestion is selected */
  onSelect: (suggestion: string) => void;
  /** Title shown above the suggestions */
  title?: string;
  /** Additional class name */
  className?: string;
}

/**
 * @description
 * Quick reply suggestion chips for common user actions.
 *
 * Renders a grid of clickable suggestion buttons that trigger the `onSelect` callback when clicked.
 * Useful for empty states to guide initial user engagement or for providing contextual action shortcuts.
 *
 * Returns null if the suggestions array is empty, allowing conditional rendering without explicit checks.
 *
 * @example
 * ```tsx
 * <QuickReplies
 *   suggestions={['Hello', 'Help me with...', 'Show examples']}
 *   title="Try asking:"
 *   onSelect={(text) => sendMessage(text)}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function QuickReplies({
  suggestions,
  onSelect,
  title = '',
  className = '',
}: QuickRepliesProps): React.ReactElement | null {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`hexos-quick-replies ${className}`}>
      {title && <p className="hexos-quick-replies__title">{title}</p>}
      <div className="hexos-quick-replies__list">
        {suggestions.map((suggestion, index) => (
          <Button
            key={`${suggestion}-${index}`}
            type="button"
            variant="ghost"
            className="hexos-quick-replies__item"
            onClick={() => onSelect(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
