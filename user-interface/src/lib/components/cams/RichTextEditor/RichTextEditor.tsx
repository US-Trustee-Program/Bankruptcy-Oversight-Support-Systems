import './RichTextEditor.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Editor } from './Editor';
import { BrowserSelectionService } from './SelectionService.humble';
import { RichTextButton } from './RichTextButton';
import editorUtilities, { safelyGetHtml, safelySetHtml } from './Editor.utilities';

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
  const { id, label, ariaDescription, onChange, required, className, disabled } = props;

  const contentRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);
  const [selectionService] = useState<BrowserSelectionService>(
    () => new BrowserSelectionService(window, document),
  );

  useEffect(() => {
    if (contentRef.current && !editorRef.current) {
      editorRef.current = new Editor(contentRef.current, selectionService);
    }
  }, []);

  useEffect(() => {
    setInputDisabled(disabled || false);
  }, [disabled]);

  const clearValue = () => {
    if (contentRef.current && editorRef.current) {
      contentRef.current.innerHTML = '';
      // Re-initialize with empty paragraph
      editorRef.current = new Editor(contentRef.current, selectionService);
      onChange?.('');
    }
  };

  const getValue = () => contentRef.current?.innerText || '';

  const getHtml = () => {
    return editorUtilities.cleanHtml(safelyGetHtml(contentRef.current));
  };

  const setValue = (html: string) => {
    if (contentRef.current) {
      if (html.trim() === '') {
        // If setting empty content, reinitialize with empty paragraph
        contentRef.current.innerHTML = '';
        if (editorRef.current) {
          editorRef.current = new Editor(contentRef.current, selectionService);
        }
      } else {
        safelySetHtml(contentRef.current, html);
      }
    }
  };
  const disable = (val: boolean) => setInputDisabled(val);
  const focus = () => {
    if (contentRef.current) {
      contentRef.current.focus();

      // If the editor is empty, position cursor in the empty paragraph
      if (editorUtilities.isEmptyContent(contentRef.current)) {
        const p = contentRef.current.querySelector('p');
        if (p?.firstChild) {
          const selection = window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.setStart(p.firstChild, 1); // After the zero-width space
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (editorRef.current?.handleCtrlKey(e)) {
      return;
    }

    if (
      editorRef.current?.handleBackspaceOnEmptyContent &&
      editorRef.current.handleBackspaceOnEmptyContent(e)
    ) {
      return;
    }

    if (editorRef.current?.handleDentures(e)) {
      onChange?.(getHtml());
      return;
    }

    if (editorRef.current?.handleEnterKey(e)) {
      return;
    }

    if (editorRef.current?.handleDeleteKeyOnList(e)) {
      return;
    }

    if (editorRef.current?.handlePrintableKey(e)) {
      onChange?.(getHtml());
      return;
    }
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

      <div className="editor-toolbar">
        <RichTextButton
          title="Bold (Ctrl+B)"
          ariaLabel="Set bold formatting"
          onClick={() => editorRef.current?.toggleSelection('strong')}
        >
          B
        </RichTextButton>
        <RichTextButton
          title="Italic (Ctrl+I)"
          ariaLabel="Set italic formatting"
          style={{ fontStyle: 'italic' }}
          onClick={() => editorRef.current?.toggleSelection('em')}
        >
          I
        </RichTextButton>
        <RichTextButton
          title="Underline (Ctrl+U)"
          ariaLabel="Set underline formatting"
          style={{ textDecoration: 'underline' }}
          onClick={() => editorRef.current?.toggleSelection('u')}
        >
          U
        </RichTextButton>
        <RichTextButton
          icon="bulleted-list"
          title="Bulleted List"
          ariaLabel="Insert bulleted list"
          onClick={() => {
            editorRef.current?.toggleList('ul');
            onChange?.(getHtml());
          }}
        ></RichTextButton>
        <RichTextButton
          icon="numbered-list"
          title="Numbered List"
          ariaLabel="Insert numbered list"
          onClick={() => {
            editorRef.current?.toggleList('ol');
            onChange?.(getHtml());
          }}
        ></RichTextButton>
      </div>
      <div
        id={id}
        data-testid={id}
        className={`editor-content ${className || ''}`}
        contentEditable={!inputDisabled}
        tabIndex={0}
        onInput={() => onChange?.(getHtml())}
        onKeyDown={handleKeyDown}
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

const RichTextEditor = forwardRef(_RichTextEditor);
export default RichTextEditor;
