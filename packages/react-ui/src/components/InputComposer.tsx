import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import type { Attachment } from '@hexos/react-core';
import { Textarea } from '../primitives/Textarea.js';
import { Button } from '../primitives/Button.js';

/**
 * @description
 * Props for the {@link InputComposer} component.
 *
 * @docsCategory ui-components
 */
export interface InputComposerProps {
  onSubmit: (content: string, attachments?: Attachment[]) => void;
  placeholder?: string;
  disabled?: boolean;
  enableAttachments?: boolean;
  enableVoice?: boolean;
  maxLength?: number;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * @description
 * SVG icon for send button.
 *
 * @docsCategory ui-components
 */
const SendIcon = (): React.ReactElement => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 19V5" />
    <path d="M5 12L12 5L19 12" />
  </svg>
);

/**
 * @description
 * SVG icon for attachment button.
 *
 * @docsCategory ui-components
 */
const PaperclipIcon = (): React.ReactElement => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
);

/**
 * @description
 * Message input composer with attachment support and auto-resize.
 *
 * Provides a WhatsApp-style rounded container with integrated send button and optional file attachments.
 * The textarea automatically resizes based on content using the {@link Textarea} primitive.
 *
 * Supports both controlled and uncontrolled modes via the `value` and `onChange` props.
 * When `enableAttachments` is true, displays a file picker that converts selected files to base64
 * data URLs for transmission.
 *
 * Keyboard behavior: Enter submits, Shift+Enter inserts a newline. The send button is disabled
 * when input is empty and no attachments are present.
 *
 * @example
 * ```tsx
 * <InputComposer
 *   onSubmit={(content, attachments) => sendMessage(content, attachments)}
 *   placeholder="Type a message..."
 *   enableAttachments
 *   maxLength={2000}
 * />
 * ```
 *
 * @docsCategory ui-components
 */
export function InputComposer({
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  enableAttachments = false,
  enableVoice: _enableVoice = false,
  maxLength,
  className = '',
  value: controlledValue,
  onChange: controlledOnChange,
}: InputComposerProps): React.ReactElement {
  const [internalValue, setInternalValue] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const value = controlledValue ?? internalValue;
  const setValue = controlledOnChange ?? setInternalValue;

  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim();
    if (!trimmedValue && attachments.length === 0) return;

    onSubmit(trimmedValue, attachments.length > 0 ? attachments : undefined);
    setValue('');
    setAttachments([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, attachments, onSubmit, setValue]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (maxLength && newValue.length > maxLength) return;
      setValue(newValue);
    },
    [setValue, maxLength]
  );

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          {
            type: file.type.startsWith('image/') ? 'image' : 'file',
            name: file.name,
            data: reader.result as string,
            mimeType: file.type,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    e.target.value = '';
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canSubmit = value.trim() || attachments.length > 0;

  return (
    <div className={`hexos-input-composer ${className}`}>
      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="hexos-input-composer__attachments">
          {attachments.map((attachment, index) => (
            <div key={index} className="hexos-input-composer__attachment">
              <span>{attachment.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAttachment(index)}
                className="hexos-input-composer__attachment-remove"
                aria-label={`Remove ${attachment.name}`}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Main input container */}
      <div className="hexos-input-composer__container">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hexos-input-composer__file-input"
          aria-hidden="true"
        />

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          autoResize
          minHeight={80}
          maxHeight={128}
          className="hexos-input-composer__textarea"
          aria-label="Message input"
        />

        <div className="hexos-input-composer__actions">
          {enableAttachments && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className="hexos-input-composer__attachment-btn"
              aria-label="Attach file"
            >
              <PaperclipIcon />
            </Button>
          )}

          {/* Send button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleSubmit}
            disabled={disabled || !canSubmit}
            className="hexos-input-composer__send-btn"
            aria-label="Send message"
          >
            <SendIcon />
          </Button>
        </div>
      </div>

      {/* Character count */}
      {maxLength && (
        <div className="hexos-input-composer__char-count">
          {value.length}/{maxLength}
        </div>
      )}
    </div>
  );
}
