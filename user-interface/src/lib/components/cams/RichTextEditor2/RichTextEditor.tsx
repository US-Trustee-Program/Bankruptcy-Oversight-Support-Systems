import * as React from 'react';
import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';
import './RichTextEditor.scss';
import { Editor } from './core/Editor';
import { BrowserSelectionService } from './core/selection/SelectionService.humble';
import { CombinedFormatState } from './core/types';

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

  // Track the combined formatting state for button UI
  const [combinedFormatState, setCombinedFormatState] = useState<CombinedFormatState>({
    currentFormatting: {
      bold: 'inactive',
      italic: 'inactive',
      underline: 'inactive',
    },
    toggleState: {
      bold: 'inactive',
      italic: 'inactive',
      underline: 'inactive',
    },
  });

  const handleOnChange = (value: string) => {
    if (onChange) {
      onChange(value);
    }
  };

  const [editor] = useState<Editor>(() => {
    const selectionService = new BrowserSelectionService(window, document);
    return new Editor({
      onChange: handleOnChange,
      onSelectionChange: (selection) => {
        // Handle selection changes here, e.g., update formatting buttons
        console.log('Selection changed:', selection);
      },
      onFormattingChange: (formatting) => {
        // Update format state for button UI
        console.log('Formatting changed:', formatting);
        console.log('Current formatting bold state:', formatting.currentFormatting.bold);
        console.log('Toggle state bold:', formatting.toggleState.bold);

        // Calculate if bold should be active
        const shouldBeActive =
          formatting.currentFormatting.bold === 'active' ||
          formatting.toggleState.bold === 'active';
        console.log('Bold button should be active:', shouldBeActive);

        setCombinedFormatState(formatting);
      },
      selectionService,
    });
  });

  // Function to handle bold button click
  const handleBoldClick = () => {
    console.log('Bold button clicked');
    console.log('Current combined format state:', combinedFormatState);
    // Add a debug log to check if event is firing
    console.trace('Bold button click stack trace');

    // Use the new toggleBold method added to the Editor class
    editor.toggleBold();
  };

  // Determine if bold button should be active
  // Active when either current text is bold OR bold formatting is pending
  const isBoldActive =
    combinedFormatState.currentFormatting.bold === 'active' ||
    combinedFormatState.toggleState.bold === 'active';

  useEffect(() => {
    if (domElementRef.current && editor) {
      editor.setRootElement(domElementRef.current);
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
      <div className="editor-toolbar">
        <button
          type="button"
          onClick={handleBoldClick}
          className={`toolbar-button ${isBoldActive ? 'active' : ''}`}
          aria-label="Bold"
          title="Bold"
          aria-pressed={isBoldActive}
          data-format-state={combinedFormatState.currentFormatting.bold}
          data-toggle-state={combinedFormatState.toggleState.bold}
        >
          <strong>B</strong>
        </button>
      </div>
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
