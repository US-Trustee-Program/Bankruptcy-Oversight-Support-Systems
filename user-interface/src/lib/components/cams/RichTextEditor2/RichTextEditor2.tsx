import './RichTextEditor2.scss';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';

export interface RichTextEditor2Ref {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

export interface RichTextEditor2Props {
  id: string;
  label?: string;
  ariaDescription?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function _RichTextEditor2(props: RichTextEditor2Props, ref: React.Ref<RichTextEditor2Ref>) {
  const { id, label, ariaDescription, onChange, required, className, disabled } = props;

  const contentRef = useRef<HTMLDivElement>(null);
  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);

  // TODO: Implement finite state machine for content and editor state
  // TODO: Implement virtual DOM for document state
  // TODO: Use HTML encoding

  const clearValue = () => {
    // TODO: Implement with state machine
    if (contentRef.current) {
      contentRef.current.innerHTML = '';
      onChange?.('');
    }
  };

  const getValue = () => {
    // TODO: Implement with virtual DOM
    return contentRef.current?.innerText || '';
  };

  const getHtml = () => {
    // TODO: Implement with virtual DOM and HTML encoding
    return contentRef.current?.innerHTML || '';
  };

  const setValue = (html: string) => {
    // TODO: Implement with state machine and virtual DOM
    if (contentRef.current) {
      contentRef.current.innerHTML = html;
    }
  };

  const disable = (val: boolean) => {
    setInputDisabled(val);
  };

  const focus = () => {
    if (contentRef.current) {
      contentRef.current.focus();
    }
  };

  useImperativeHandle(ref, () => ({
    clearValue,
    getValue,
    getHtml,
    setValue,
    disable,
    focus,
  }));

  const handleInput = () => {
    // TODO: Implement with state machine
    onChange?.(getHtml());
  };

  const handleKeyDown = (_e: React.KeyboardEvent<HTMLDivElement>) => {
    // TODO: Implement keyboard handling with state machine
  };

  const handlePaste = (_e: React.ClipboardEvent<HTMLDivElement>) => {
    // TODO: Implement paste handling with state machine
  };

  return (
    <div id={`${id}-container`} className="usa-form-group rich-text-editor-container">
      {label && (
        <label
          id={`editor-label-${id}`}
          className={`usa-label ${className ? `${className}-label` : ''}`}
        >
          {label}
          {required && <span className="required-form-field" />}
        </label>
      )}

      {ariaDescription && (
        <div className="usa-hint" id={`editor-hint-${id}`}>
          {ariaDescription}
        </div>
      )}

      {/* TODO: Implement toolbar with state machine integration */}
      <div className="editor-toolbar">
        {/* Toolbar buttons will be implemented with state machine */}
      </div>

      <div
        id={id}
        data-testid={id}
        className={`editor-content ${className || ''}`}
        contentEditable={!inputDisabled}
        tabIndex={0}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        ref={contentRef}
        aria-labelledby={label ? `editor-label-${id}` : undefined}
        aria-describedby={ariaDescription ? `editor-hint-${id}` : undefined}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
      />
    </div>
  );
}

const RichTextEditor2 = forwardRef(_RichTextEditor2);
export default RichTextEditor2;
