import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './Editor.scss';

// Regular expressions for text formatting
const PARAGRAPH_SPLIT_REGEX = /\n\n+/;
const LIST_ITEM_REGEX = /^\s*(\d+\.|\*|-)\s/;
const ORDERED_LIST_REGEX = /^\s*\d+\./;
const LINE_BREAK_REGEX = /\n/g;
const LINK_REGEX = /\[(.*?)]\((.*?)\)/g;
const BOLD_REGEX = /\*\*(.*?)\*\*/g;
const ITALIC_REGEX = /(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g;
const UNDERLINE_REGEX = /_(.*?)_/g;
const JAVASCRIPT_REGEX = /javascript:/gi;
const EVENT_HANDLER_REGEX = /on\w+=/gi;

export interface EditorRef {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

export interface EditorProps {
  id: string;
  label?: string;
  ariaDescription?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function _Editor(props: EditorProps, ref: React.Ref<EditorRef>) {
  const { id, label, ariaDescription, onChange, required, className } = props;
  const [inputValue, setInputValue] = useState<string>(props.value || '');
  const [inputDisabled, setInputDisabled] = useState<boolean>(props.disabled || false);
  const textAreaId = `editor-${id}`;
  const labelId = `editor-label-${id}`;
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Update inputValue when props.value changes
  useEffect(() => {
    setInputValue(props.value || '');
  }, [props.value]);

  // Update inputDisabled when props.disabled changes
  useEffect(() => {
    setInputDisabled(props.disabled || false);
  }, [props.disabled]);

  // Function to convert text with formatting markers to HTML
  const convertToHtml = (text: string): string => {
    if (!text) return '';

    // Process the text in multiple passes to handle nested formatting

    // First, split by double newlines to identify paragraphs
    const paragraphs = text.split(PARAGRAPH_SPLIT_REGEX);

    // Process each paragraph
    const processedParagraphs = paragraphs.map((paragraph) => {
      // Check if this is a list
      if (LIST_ITEM_REGEX.test(paragraph)) {
        // Determine if it's an ordered or unordered list
        const isOrdered = ORDERED_LIST_REGEX.test(paragraph);
        const listTag = isOrdered ? 'ol' : 'ul';

        // Split into list items
        const items = paragraph.split(LINE_BREAK_REGEX).filter((line) => line.trim());

        // Process each list item
        const listItems = items
          .map((item) => {
            // Remove the list marker
            const content = item.replace(LIST_ITEM_REGEX, '');

            // Process inline formatting within the list item
            const formattedContent = processInlineFormatting(content);

            return `<li>${formattedContent}</li>`;
          })
          .join('');

        return `<${listTag}>${listItems}</${listTag}>`;
      } else {
        // Regular paragraph - process inline formatting
        const formattedParagraph = processInlineFormatting(
          paragraph.replace(LINE_BREAK_REGEX, '<br>'),
        );
        return `<p>${formattedParagraph}</p>`;
      }
    });

    return processedParagraphs.join('');
  };

  // Helper function to process inline formatting
  const processInlineFormatting = (text: string): string => {
    let processed = text;

    // We need to process these in a specific order to avoid conflicts

    // First, handle links as they have the most complex syntax
    processed = processed.replace(LINK_REGEX, '<a href="$2">$1</a>');

    // Then handle bold (before italic, since ** would match * as well)
    processed = processed.replace(BOLD_REGEX, '<strong>$1</strong>');

    // Then handle italic
    // We use a more specific regex to avoid matching ** for bold
    processed = processed.replace(ITALIC_REGEX, '<em>$1</em>');

    // Finally handle underline
    processed = processed.replace(UNDERLINE_REGEX, '<u>$1</u>');

    // Sanitize the HTML to prevent XSS attacks
    // This is a simple implementation - in a production environment,
    // you might want to use a library like DOMPurify
    processed = processed.replace(JAVASCRIPT_REGEX, '').replace(EVENT_HANDLER_REGEX, '');

    return processed;
  };

  const clearValue = () => {
    setInputValue('');
    if (onChange) {
      onChange('');
    }
  };

  const getValue = () => {
    return inputValue;
  };

  const getHtml = () => {
    return convertToHtml(inputValue);
  };

  const setValue = (value: string) => {
    setInputValue(value);
  };

  const disable = (value: boolean) => {
    setInputDisabled(value);
  };

  const focus = () => {
    textAreaRef?.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    if (onChange) {
      onChange(newValue);
    }
  };

  function ariaDescribedBy() {
    return ariaDescription ? `editor-hint-${id}` : undefined;
  }

  useImperativeHandle(ref, () => ({
    clearValue,
    getValue,
    getHtml,
    setValue,
    disable,
    focus,
  }));

  return (
    <div className="usa-form-group editor-container">
      {label && (
        <label
          htmlFor={textAreaId}
          id={labelId}
          data-testid={labelId}
          className={`usa-label ${className ? `${className}-label` : ''}`}
        >
          {label}
          {required && <span className="required-form-field" />}
        </label>
      )}
      {ariaDescription && (
        <div className="usa-hint" id={ariaDescribedBy()}>
          {ariaDescription}
        </div>
      )}
      <div className="editor-wrapper">
        <textarea
          id={textAreaId}
          data-testid={textAreaId}
          className={`${className || ''} usa-textarea editor-textarea`}
          value={inputValue}
          onChange={handleChange}
          disabled={inputDisabled}
          ref={textAreaRef}
          aria-describedby={ariaDescribedBy()}
          placeholder="Enter text here. Use formatting options shown below."
        />
        {inputValue && (
          <div className="editor-preview-container">
            <div className="editor-preview-header">Preview</div>
            <div className="editor-preview" dangerouslySetInnerHTML={{ __html: getHtml() }} />
          </div>
        )}
      </div>
      <div className="editor-help">
        <p>Formatting options:</p>
        <ul className="editor-help-list">
          <li>
            <strong>**bold**</strong> for bold text
          </li>
          <li>
            <em>*italic*</em> for italic text
          </li>
          <li>
            <u>_underline_</u> for underlined text
          </li>
          <li>[link text](https://example.com) for hyperlinks</li>
          <li>
            Lists:
            <ul>
              <li>* item or - item for unordered lists</li>
              <li>1. item for ordered lists</li>
            </ul>
          </li>
          <li>Use blank lines to create new paragraphs</li>
        </ul>
      </div>
    </div>
  );
}

const Editor = forwardRef(_Editor);

export default Editor;
