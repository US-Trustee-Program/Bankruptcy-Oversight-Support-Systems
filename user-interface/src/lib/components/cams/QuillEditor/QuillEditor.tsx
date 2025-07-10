import './QuillEditor.scss';
import 'quill/dist/quill.snow.css';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Quill from 'quill';
import { sanitizeText } from '@/lib/utils/sanitize-text';

// Define the interface for the QuillEditor ref
export interface QuillEditorRef {
  clearValue: () => void;
  getValue: () => string;
  getHtml: () => string;
  setValue: (value: string) => void;
  disable: (value: boolean) => void;
  focus: () => void;
}

// Define the props interface
export interface QuillEditorProps {
  id: string;
  label?: string;
  ariaDescription?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

// Create a humble object wrapper for Quill that only exposes bold text functionality
function _QuillEditor(props: QuillEditorProps, ref: React.Ref<QuillEditorRef>) {
  const { id, label, ariaDescription, onChange, required, className, disabled } = props;

  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const [_inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);

  // Initialize Quill editor
  useEffect(() => {
    console.log('Initializing Quill for editor:', id);
    if (!quillRef.current && editorRef.current) {
      try {
        // Initialize Quill with minimal configuration and explicitly disable the toolbar module
        quillRef.current = new Quill(editorRef.current, {
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline'],
              ['link', 'blockquote'],
              [{ list: 'ordered' }, { list: 'bullet' }],
            ],
          },
          placeholder: 'Enter note text...',
          theme: 'snow', // Use the snow theme which is clean and simple
        });

        // Set up change handler
        if (quillRef.current) {
          quillRef.current.on('text-change', () => {
            onChange?.(getHtml());
          });
        }
      } catch (error) {
        console.error('Error initializing Quill:', error);
      }
    }

    return () => {
      // Remove any Quill-injected toolbars in the parent container
      if (editorRef.current) {
        const toolbars = editorRef.current.parentElement?.querySelectorAll('.ql-toolbar');
        toolbars?.forEach((toolbar) => toolbar.remove());
        // Clear the editor div's contents
        editorRef.current.innerHTML = '';
      }
      quillRef.current = null;
      console.log('QuillEditor unmounted', id);
    };
  }, []);

  // Update disabled state when props change
  useEffect(() => {
    setInputDisabled(disabled || false);
    if (quillRef.current) {
      quillRef.current.enable(!disabled);
    }
  }, [disabled]);

  // Clear the editor content
  const clearValue = () => {
    if (quillRef.current) {
      try {
        quillRef.current.setText('');
        onChange?.('');
      } catch (error) {
        console.error('Error clearing Quill content:', error);
      }
    }
  };

  // Get plain text content
  const getValue = () => {
    if (quillRef.current) {
      try {
        return sanitizeText(quillRef.current.getText() || '');
      } catch (error) {
        console.error('Error getting Quill text:', error);
        return '';
      }
    }
    return '';
  };

  // Get HTML content
  const getHtml = () => {
    if (quillRef.current && quillRef.current.root) {
      try {
        const html = quillRef.current.root.innerHTML;
        // Check if the content is empty (just a paragraph with a break or empty)
        if (html === '' || html === '<p><br></p>' || html === '<p></p>') {
          return '';
        }
        return html;
      } catch (error) {
        console.error('Error getting Quill HTML:', error);
        return '';
      }
    }
    return '';
  };

  // Set HTML content
  const setValue = (html: string) => {
    if (quillRef.current) {
      try {
        // Use Quill's clipboard API to properly parse HTML and preserve list types
        quillRef.current.clipboard.dangerouslyPasteHTML(html);
      } catch (error) {
        console.error('Error setting Quill HTML:', error);
      }
    }
  };

  // Enable/disable the editor
  const disable = (val: boolean) => {
    setInputDisabled(val);
    if (quillRef.current) {
      try {
        quillRef.current.enable(!val);
      } catch (error) {
        console.error('Error enabling/disabling Quill:', error);
      }
    }
  };

  // Focus the editor
  const focus = () => {
    if (quillRef.current) {
      try {
        quillRef.current.focus();
      } catch (error) {
        console.error('Error focusing Quill:', error);
      }
    }
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    clearValue,
    getValue,
    getHtml,
    setValue,
    disable,
    focus,
  }));

  useEffect(() => {
    console.log('QuillEditor mounted', id);
    return () => {
      console.log('QuillEditor unmounted', id);
    };
  }, []);

  return (
    <div
      id={`${id}-container`}
      className={`usa-form-group quill-editor-container`}
      data-testid={`${id}-container`}
    >
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

      <div
        id={id}
        data-testid={id}
        className={`quill-editor ${className || ''}`}
        ref={editorRef}
        aria-labelledby={label ? `editor-label-${id}` : undefined}
        aria-describedby={ariaDescription ? `editor-hint-${id}` : undefined}
        role="textbox"
        tabIndex={0}
      />
    </div>
  );
}

const QuillEditor = forwardRef(_QuillEditor);
export default QuillEditor;
