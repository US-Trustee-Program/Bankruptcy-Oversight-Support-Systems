import './RichTextEditor.scss';
import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Paragraph from '@tiptap/extension-paragraph';
import { NumberedListIcon, BulletListIcon } from './RichTextIcon';
import Underline from '@tiptap/extension-underline';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import Text from '@tiptap/extension-text';
import Document from '@tiptap/extension-document';
import { UndoRedo } from '@tiptap/extensions';

export interface RichTextEditorRef {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

interface RichTextEditorProps {
  id: string;
  label?: string;
  ariaDescription?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function TiptapEditor_(props: RichTextEditorProps, ref: React.Ref<RichTextEditorRef>) {
  const { id, ariaDescription, onChange, required, className, disabled } = props;
  const label = props.label || 'Text';

  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);

  const editor = useEditor({
    extensions: [
      Paragraph,
      Bold,
      Italic,
      Underline,
      OrderedList,
      BulletList,
      ListItem,
      Text,
      Document,
      UndoRedo,
    ],
    immediatelyRender: true,
    content: '',
    editable: !inputDisabled,
    onUpdate: ({ editor }) => {
      if (editor) {
        const html = editor.getHTML();
        onChange?.(html);
      }
    },
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        'aria-labelledby': `editor-label-${id}`,
        role: 'textbox',
      },
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
    if (html.trim() === '') {
      editor?.commands.clearContent();
    } else {
      editor?.commands.setContent(html);
    }
  };

  const disable = (val: boolean) => {
    setInputDisabled(val);
  };

  const focus = () => {
    editor?.commands.focus();
  };

  const getToggleButtonClass = (formatType: string) => {
    return `rich-text-button${editor?.isActive(formatType) ? ' is-active' : ''}`;
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
    <div id={`${id}-container`} className={`usa-form-group editor-container ${className || ''}`}>
      <div
        id={`editor-label-${id}`}
        data-testid={`editor-label-${id}`}
        className={`usa-label ${className ? `${className}-label` : ''}`}
      >
        {label}
        {required && <span className="required-form-field"> *</span>}
      </div>

      {ariaDescription && (
        <div className="usa-hint" id={`editor-hint-${id}`}>
          {ariaDescription}
        </div>
      )}

      <div className="editor-wrapper">
        {/* Toolbar */}
        <div className="editor-toolbar">
          <button
            type="button"
            className={`rich-text-button${editor?.isActive('bold') ? ' is-active' : ''}`}
            disabled={inputDisabled || !editor.isEditable}
            aria-disabled={inputDisabled || !editor.isEditable}
            title="Bold (Ctrl+B)"
            aria-label="Activate Bold with Ctrl+B"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            data-testid="rich-text-bold-button"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            title="Italic (Ctrl+I)"
            aria-label="Activate Italic with Ctrl+I"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={getToggleButtonClass('italic')}
            disabled={inputDisabled || !editor.isEditable}
            data-testid="rich-text-italic-button"
          >
            <em>I</em>
          </button>
          <button
            type="button"
            title="Underline (Ctrl+U)"
            aria-label="Activate Underline with Ctrl+U"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={getToggleButtonClass('underline')}
            disabled={inputDisabled || !editor.isEditable}
            data-testid="rich-text-underline-button"
          >
            U
          </button>
          <button
            title="Ordered List (Ctrl+Shift+7)"
            aria-label="Create Ordered List with Ctrl+Shift+7"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={getToggleButtonClass('orderedList')}
            disabled={inputDisabled || !editor.isEditable}
            data-testid="rich-text-ordered-list-button"
          >
            <NumberedListIcon />
          </button>
          <button
            title="Bullet List (Ctrl+Shift+8)"
            aria-label="Create Bullet List with Ctrl+Shift+8"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={getToggleButtonClass('bulletList')}
            disabled={inputDisabled || !editor.isEditable}
            data-testid="rich-text-unordered-list-button"
          >
            <BulletListIcon />
          </button>
        </div>

        <EditorContent
          editor={editor}
          className={`editor-content editor${inputDisabled ? ' disabled' : ''}`}
          data-testid="editor-content"
        />
      </div>
    </div>
  );
}

const RichTextEditor = forwardRef(TiptapEditor_);
export default RichTextEditor;
