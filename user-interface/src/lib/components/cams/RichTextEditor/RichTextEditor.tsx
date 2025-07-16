import './RichTextEditor.scss';
import { forwardRef, useEffect, useImperativeHandle, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { NumberedListIcon, BulletListIcon, LinkIcon } from './RichTextIcon';
import Icon from '../../uswds/Icon';
import useOutsideClick from '@/lib/hooks/UseOutsideClick';
import { sanitizeUrl } from '@common/cams/sanitization';

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

function _TiptapEditor(props: RichTextEditorProps, ref: React.Ref<RichTextEditorRef>) {
  const { id, label, ariaDescription, onChange, required, className, disabled } = props;

  const [inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);
  const [showLinkPopover, setShowLinkPopover] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const linkPopoverRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkTextInputRef = useRef<HTMLInputElement>(null);

  useOutsideClick([linkPopoverRef], isOutsideClick);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Link],
    immediatelyRender: true,
    content: '',
    editable: !inputDisabled,
    onUpdate: ({ editor }) => {
      if (editor) {
        const html = editor.getHTML();
        onChange?.(html);
      }
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

  function isOutsideClick(ev: MouseEvent) {
    if (linkPopoverRef.current && showLinkPopover) {
      const boundingRect = (linkPopoverRef.current as HTMLDivElement).getBoundingClientRect();
      const containerRight = boundingRect.x + boundingRect.width;
      const containerBottom = boundingRect.y + boundingRect.height;
      const targetX = ev.clientX;
      const targetY = ev.clientY;
      if (
        targetX < boundingRect.x ||
        targetX > containerRight ||
        targetY < boundingRect.y ||
        targetY > containerBottom
      ) {
        setShowLinkPopover(false);
      }
    }
  }

  const handleLinkButtonClick = () => {
    if (editor) {
      setShowLinkPopover(true);
      // Pre-fill with current link if selection has one
      const currentLink = editor?.getAttributes('link').href || '';
      setLinkUrl(currentLink);
      // Pre-fill display text with selection or link text
      const { selection } = editor.state;
      let selectedText = '';
      if (!selection.empty) {
        selectedText = editor.state.doc.textBetween(selection.from, selection.to, ' ');
      } else if (currentLink) {
        // If cursor is in a link, get the link text
        selectedText = editor.getAttributes('link').text || '';
      }
      setLinkText(selectedText);
    }
    setTimeout(() => linkInputRef.current?.focus(), 0);
  };

  const handleLinkApply = () => {
    const display = linkText || linkUrl;
    if (display) {
      editor
        ?.chain()
        .focus()
        .insertContent(`<a href="${sanitizeUrl(linkUrl)}">${display}</a>`)
        .run();
    }
    setShowLinkPopover(false);
    setLinkUrl('');
    setLinkText('');
  };

  const handleLinkCancel = () => {
    setShowLinkPopover(false);
    setLinkUrl('');
    setLinkText('');
  };

  const handleLinkKeyDown = (e: KeyboardEvent) => {
    if (showLinkPopover && e.key === 'Escape') {
      handleLinkCancel();
    }
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

  useEffect(() => {
    window.addEventListener('keydown', handleLinkKeyDown);
    return () => {
      window.removeEventListener('keydown', handleLinkKeyDown);
    };
  }, [showLinkPopover]);

  return (
    <div id={`${id}-container`} className={`usa-form-group editor-container ${className || ''}`}>
      {label && (
        <label
          id={`editor-label-${id}`}
          data-testid={`editor-label-${id}`}
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

      <div className="editor-wrapper">
        {/* Toolbar */}
        <div className="editor-toolbar">
          <button
            type="button"
            className={`rich-text-button${editor?.isActive('bold') ? ' is-active' : ''}`}
            disabled={inputDisabled || !editor.isEditable}
            aria-disabled={inputDisabled || !editor.isEditable}
            aria-label="Bold"
            title="Bold"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            data-testid="rich-text-bold-button"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            aria-label="Italic"
            title="Italic"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={getToggleButtonClass('italic')}
            disabled={inputDisabled || !editor.isEditable}
          >
            <em>I</em>
          </button>
          <button
            type="button"
            aria-label="Underline"
            title="Underline"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
            className={getToggleButtonClass('underline')}
            disabled={inputDisabled || !editor.isEditable}
          >
            U
          </button>
          <button
            aria-label="Ordered List"
            title="Ordered List"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={getToggleButtonClass('orderedList')}
            disabled={inputDisabled || !editor.isEditable}
          >
            <NumberedListIcon />
          </button>
          <button
            aria-label="Bullet List"
            title="Bullet List"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={getToggleButtonClass('bulletList')}
            disabled={inputDisabled || !editor.isEditable}
          >
            <BulletListIcon />
          </button>
          <button
            aria-label="Link"
            title="Link"
            onClick={handleLinkButtonClick}
            className={getToggleButtonClass('link')}
            disabled={inputDisabled || !editor.isEditable}
            data-testid="rich-text-link-button"
          >
            <LinkIcon />
          </button>
          {showLinkPopover && (
            <div className="editor-link-popover" ref={linkPopoverRef}>
              <input
                ref={linkInputRef}
                type="text"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Paste a link..."
                className="editor-link-input"
              />
              <input
                ref={linkTextInputRef}
                type="text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Display text"
                className="editor-link-input display-text-input"
              />
              <button type="button" onClick={handleLinkApply} className="editor-link-apply">
                <Icon name="check" />
              </button>
              <button type="button" onClick={handleLinkCancel} className="editor-link-delete">
                <Icon name="delete" />
              </button>
            </div>
          )}
        </div>

        <EditorContent
          editor={editor}
          className={`editor-content editor${inputDisabled ? ' disabled' : ''}`}
          data-testid="editor-content"
          aria-labelledby={label ? `editor-label-${id}` : undefined}
          role="textbox"
          aria-multiline="true"
        />
      </div>
    </div>
  );
}

const RichTextEditor = forwardRef(_TiptapEditor);

export default RichTextEditor;
