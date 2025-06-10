import './RichTextEditor.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  cleanZeroWidthSpaces,
  handleCtrlKey,
  handleDentures,
  handleEnterKey,
  handlePrintableKey,
  toggleList,
  toggleSelection,
} from './richTextEditorUtilities';
import { RichTextButton } from './RichTextButton';

export interface RichTextEditorRef {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

export interface RichTextEditorProps {
  id: string;
  label?: string;
  ariaDescription?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function _RichTextEditor(props: RichTextEditorProps, ref: React.Ref<RichTextEditorRef>) {
  const { id, label, ariaDescription, onChange, required, className, value, disabled } = props;

  const contentRef = useRef<HTMLDivElement>(null);
  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);

  useEffect(() => {
    setInputDisabled(disabled || false);
  }, [disabled]);

  useEffect(() => {
    if (value && contentRef.current) {
      contentRef.current.innerHTML = value;
    }
  }, [value]);

  const clearValue = () => {
    if (contentRef.current) {
      contentRef.current.innerHTML = '';
      onChange?.('');
    }
  };

  const getValue = () => contentRef.current?.innerText || '';
  const getHtml = () => {
    const rawHtml = contentRef.current?.innerHTML || '';
    return cleanZeroWidthSpaces(rawHtml);
  };

  const setValue = (html: string) => {
    if (contentRef.current) {
      contentRef.current.innerHTML = html;
    }
  };
  const disable = (val: boolean) => setInputDisabled(val);
  const focus = () => contentRef.current?.focus();

  useImperativeHandle(ref, () => ({
    clearValue,
    getValue,
    getHtml,
    setValue,
    disable,
    focus,
  }));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (handleCtrlKey(e)) {
      return;
    }

    if (handleDentures(e)) {
      onChange?.(getHtml());
      return;
    }

    if (handleEnterKey(e)) {
      return;
    }

    if (handlePrintableKey(e)) {
      onChange?.(getHtml());
      return;
    }
  };

  return (
    <div className="usa-form-group rich-text-editor-container">
      {label && (
        <label
          htmlFor={id}
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

      <div className="editor-toolbar">
        <RichTextButton
          title="Bold (Ctrl+B)"
          ariaLabel="Set bold formatting"
          onClick={() => toggleSelection('strong')}
        >
          B
        </RichTextButton>
        <RichTextButton
          title="Italic (Ctrl+I)"
          ariaLabel="Set italic formatting"
          style={{ fontStyle: 'italic' }}
          onClick={() => toggleSelection('em')}
        >
          I
        </RichTextButton>
        <RichTextButton
          title="Underline (Ctrl+U)"
          ariaLabel="Set underline formatting"
          style={{ textDecoration: 'underline' }}
          onClick={() => toggleSelection('u')}
        >
          U
        </RichTextButton>
        <RichTextButton
          icon="bulleted-list"
          title="Bulleted List"
          ariaLabel="Insert bulleted list"
          onClick={() => {
            toggleList('ul');
            onChange?.(getHtml());
          }}
        ></RichTextButton>
        <RichTextButton
          icon="numbered-list"
          title="Numbered List"
          ariaLabel="Insert numbered list"
          onClick={() => {
            toggleList('ol');
            onChange?.(getHtml());
          }}
        ></RichTextButton>
      </div>
      <div
        id={id}
        className={`editor-content ${className || ''}`}
        contentEditable={!inputDisabled}
        tabIndex={0}
        onInput={() => onChange?.(getHtml())}
        onKeyDown={handleKeyDown}
        ref={contentRef}
        aria-describedby={ariaDescription ? `editor-hint-${id}` : undefined}
        role="textbox"
        aria-multiline="true"
        suppressContentEditableWarning
      />
    </div>
  );
}

const RichTextEditor = forwardRef(_RichTextEditor);
export default RichTextEditor;
