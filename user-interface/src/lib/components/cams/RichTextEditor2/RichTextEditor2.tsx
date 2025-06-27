import './RichTextEditor2.scss';
import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react';
import { Editor, EditorChangeListener } from './editor/Editor';
import { BrowserSelectionService } from './SelectionService.humble';
import * as React from 'react';

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

function _RichTextEditor2Internal(props: RichTextEditor2Props, ref: React.Ref<RichTextEditor2Ref>) {
  const { id, label, ariaDescription, onChange, required, className, disabled } = props;

  const contentRef = useRef<HTMLDivElement>(null);
  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);
  const editorRef = useRef<Editor | null>(null);

  // Initialize Editor when contentRef is available
  useEffect(() => {
    if (contentRef.current && !editorRef.current) {
      const selectionService = new BrowserSelectionService(window, document);
      editorRef.current = new Editor(contentRef.current, selectionService);

      // Register onChange listener if provided
      if (onChange) {
        const changeListener: EditorChangeListener = (html: string) => {
          onChange(html);
        };
        editorRef.current.onContentChange(changeListener);
      }
    }

    return () => {
      // Cleanup on unmount
      if (editorRef.current) {
        editorRef.current.destroy();
      }
    };
  }, [onChange]);

  // Update disabled state when prop changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.disable(disabled || false);
    }
    setInputDisabled(disabled || false);
  }, [disabled]);

  // Delegate all ref methods to Editor
  const clearValue = () => {
    editorRef.current?.clearValue();
  };

  const getValue = () => {
    return editorRef.current?.getValue() || '';
  };

  const getHtml = () => {
    return editorRef.current?.getHtml() || '';
  };

  const setValue = (html: string) => {
    editorRef.current?.setValue(html);
  };

  const disable = (val: boolean) => {
    setInputDisabled(val);
    editorRef.current?.disable(val);
  };

  const focus = () => {
    editorRef.current?.focus();
  };

  useImperativeHandle(ref, () => ({
    clearValue,
    getValue,
    getHtml,
    setValue,
    disable,
    focus,
  }));

  // Delegate all event handlers to Editor
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    editorRef.current?.handleInput(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    editorRef.current?.handleKeyDown(e);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    editorRef.current?.handlePaste(e);
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
        {/* Toolbar buttons will be implemented with the state machine */}
        {/* Toolbar buttons must use the RichTextButton component. */}
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

const RichTextEditor2Internal = forwardRef(_RichTextEditor2Internal);

function _RichTextEditor2(props: RichTextEditor2Props, ref: React.Ref<RichTextEditor2Ref>) {
  return <RichTextEditor2Internal {...props} ref={ref} />;
}

const RichTextEditor2 = forwardRef(_RichTextEditor2);
export default RichTextEditor2;
