import React, { useCallback, useRef, useImperativeHandle } from 'react';

/**
 * @description
 * Props for the {@link Textarea} component.
 *
 * Extends standard HTML textarea attributes with auto-resize capability and height constraints.
 *
 * @docsCategory ui-primitives
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Enable auto-resize based on content */
  autoResize?: boolean;
  /** Minimum height in pixels (only when autoResize is true) */
  minHeight?: number;
  /** Maximum height in pixels (only when autoResize is true) */
  maxHeight?: number;
}

const BASE_CLASSES =
  'ax-w-full ax-bg-transparent ax-border-0 ax-outline-none ax-resize-none ax-text-base ax-leading-relaxed';

/**
 * @description
 * Auto-resizing textarea component.
 *
 * Provides a textarea that automatically adjusts its height based on content when `autoResize` is enabled.
 * Height is constrained between `minHeight` and `maxHeight` props.
 *
 * The component recalculates height on every onChange event, expanding or contracting to fit content
 * while respecting the maximum height constraint with scrolling.
 *
 * Uses imperative handle to expose the internal ref while supporting forwarded refs from parent components.
 *
 * @example
 * ```tsx
 * <Textarea
 *   autoResize
 *   minHeight={80}
 *   maxHeight={200}
 *   placeholder="Type a message..."
 * />
 * ```
 *
 * @docsCategory ui-primitives
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className = '',
      autoResize = false,
      minHeight = 80,
      maxHeight = 128,
      onChange,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => internalRef.current!);

    const handleResize = useCallback(() => {
      const textarea = internalRef.current;
      if (!textarea || !autoResize) return;
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }, [autoResize, maxHeight]);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(e);
        handleResize();
      },
      [onChange, handleResize]
    );

    return (
      <textarea
        ref={internalRef}
        className={`${BASE_CLASSES} ${className}`}
        onChange={handleChange}
        style={autoResize ? { minHeight: `${minHeight}px`, maxHeight: `${maxHeight}px` } : undefined}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
