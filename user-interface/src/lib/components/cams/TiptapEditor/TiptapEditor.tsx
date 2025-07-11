import './TiptapEditor.scss';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export interface TiptapEditorRef {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

export interface TiptapEditorProps {
  id: string;
  label?: string;
  ariaDescription?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function _TiptapEditor(props: TiptapEditorProps, ref: React.Ref<TiptapEditorRef>) {
  const { id, label, ariaDescription, onChange, required, className, disabled } = props;

  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    editable: !inputDisabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
    },
  });

  useEffect(() => {
    setInputDisabled(disabled || false);
  }, [disabled]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!inputDisabled);
    }
  }, [inputDisabled, editor]);

  const clearValue = () => {
    if (editor) {
      editor.commands.clearContent();
      onChange?.('');
    }
  };

  const getValue = () => {
    return editor?.getText() || '';
  };

  const getHtml = () => {
    return editor?.getHTML() || '';
  };

  const setValue = (html: string) => {
    if (editor) {
      if (html.trim() === '') {
        editor.commands.clearContent();
      } else {
        editor.commands.setContent(html);
      }
    }
  };

  const disable = (val: boolean) => {
    setInputDisabled(val);
  };

  const focus = () => {
    if (editor) {
      editor.commands.focus();
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

  return (
    <div id={`${id}-container`} className="usa-form-group tiptap-editor-container">
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

      <div className="tiptap-editor-wrapper">
        <EditorContent
          editor={editor}
          className={`tiptap-editor ${inputDisabled ? 'disabled' : ''}`}
        />
      </div>
    </div>
  );
}

const TiptapEditor = forwardRef(_TiptapEditor);

export default TiptapEditor;
