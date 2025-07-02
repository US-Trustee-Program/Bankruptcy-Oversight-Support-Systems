import * as React from 'react';
import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import './RichTextEditor.scss';
import { Editor } from './core/Editor';

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
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function _RichTextEditor(props: RichTextEditorProps, ref: React.Ref<RichTextEditorRef>) {
  const { id, label, ariaDescription, onChange, disabled, required, className } = props;

  const domElementRef = useRef<HTMLDivElement>(null);

  const handleOnChange = (value: string) => {
    if (domElementRef.current) {
      domElementRef.current.innerHTML = value;
    }
    if (onChange) {
      onChange(value);
    }
  };

  const [editor] = useState<Editor>(() => {
    return new Editor({ onChange: handleOnChange });
  });

  // Set up DOM element and event listeners after mount
  useEffect(() => {
    if (domElementRef.current && editor) {
      domElementRef.current.innerHTML = editor.getHtml();

      // Add beforeinput event listener to capture user input
      const handleBeforeInput = (e: Event) => {
        const inputEvent = e as InputEvent;
        editor.handleBeforeInput(inputEvent);
        e.preventDefault();
      };

      domElementRef.current.addEventListener('beforeinput', handleBeforeInput);

      return () => {
        if (domElementRef.current) {
          domElementRef.current.removeEventListener('beforeinput', handleBeforeInput);
        }
      };
    }
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      clearValue: () => editor.clearValue(),
      getValue: () => editor.getValue(),
      getHtml: () => editor.getHtml(),
      setValue: (value: string) => editor.setValue(value),
      disable: (value: boolean) => {
        if (domElementRef.current) {
          domElementRef.current.contentEditable = (!value).toString();
        }
      },
      focus: () => domElementRef.current?.focus(),
    }),
    [editor],
  );

  return (
    <div id={`${id}-container`} className="usa-form-group rich-text-editor-container">
      <label
        className={`usa-label ${!label && 'usa-sr-only'}`}
        id={`editor-label-${id}`}
        htmlFor={id}
      >
        {label || 'Rich text editor'}
      </label>
      <div className="editor-toolbar">{/* Toolbar will go here */}</div>
      <div
        contentEditable={!disabled}
        ref={domElementRef}
        id={id}
        className={`editor-content ${className || ''}`}
        role="textbox"
        tabIndex={0}
        aria-multiline="true"
        aria-labelledby={`editor-label-${id}`}
        aria-describedby={ariaDescription ? `${id}-description` : undefined}
        aria-required={required}
        data-testid={id}
      />
      {ariaDescription && (
        <div className="usa-hint" id={`${id}-description`}>
          {ariaDescription}
        </div>
      )}
    </div>
  );
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(_RichTextEditor);
export default RichTextEditor;
