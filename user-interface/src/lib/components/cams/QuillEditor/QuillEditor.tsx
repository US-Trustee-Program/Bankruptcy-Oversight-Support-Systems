import './QuillEditor.scss';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Quill from 'quill';
import { sanitizeText } from '@/lib/utils/sanitize-text';
import Button from '../../uswds/Button';

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

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const [_inputDisabled, setInputDisabled] = useState<boolean>(disabled || false);
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Initialize Quill editor
  useEffect(() => {
    if (!quillRef.current && editorRef.current) {
      try {
        // Initialize Quill with minimal configuration and explicitly disable the toolbar module
        quillRef.current = new Quill(editorRef.current, {
          modules: {
            toolbar: false, // Explicitly disable the toolbar module
          },
          placeholder: 'Enter note text...',
          theme: 'snow', // Use the snow theme which is clean and simple
        });

        // Set up change handler
        if (quillRef.current) {
          quillRef.current.on('text-change', () => {
            onChange?.(getHtml());
          });

          // Set up selection-change handler to update format state
          quillRef.current.on('selection-change', (range) => {
            if (range) {
              // Get the format at the current selection
              const format = quillRef.current?.getFormat(range);
              // Update bold and italic states
              setIsBold(!!format?.bold);
              setIsItalic(!!format?.italic);
            }
          });
        }
      } catch (error) {
        console.error('Error initializing Quill:', error);
      }
    }

    return () => {
      // Clean up Quill instance if needed
      quillRef.current = null;
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
    if (quillRef.current && quillRef.current.root) {
      try {
        quillRef.current.root.innerHTML = html;
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

  return (
    <div
      id={`${id}-container`}
      className="usa-form-group quill-editor-container"
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
        id={`${id}-wrapper`}
        className={`quill-editor-wrapper ${className || ''}`}
        ref={editorContainerRef}
      >
        {/* Custom toolbar container */}
        <div id={`${id}-toolbar`} ref={toolbarRef} className="quill-custom-toolbar editor-toolbar">
          <Button
            type="button"
            aria-label="Set bold formatting"
            title="Bold"
            className={`usa-button rich-text-button custom-bold-button ${isBold ? 'active' : ''}`}
            data-testid="bold-button"
            onClick={() => {
              if (quillRef.current) {
                try {
                  const format = quillRef.current.getFormat();
                  const newBoldValue = !format.bold;
                  quillRef.current.format('bold', newBoldValue);
                  // Update state immediately
                  setIsBold(newBoldValue);
                } catch (error) {
                  console.error('Error toggling bold format:', error);
                }
              }
            }}
          >
            B
          </Button>
          <Button
            type="button"
            aria-label="Set italic formatting"
            title="Italic"
            className={`usa-button rich-text-button custom-italic-button ${isItalic ? 'active' : ''}`}
            data-testid="italic-button"
            onClick={() => {
              if (quillRef.current) {
                try {
                  const format = quillRef.current.getFormat();
                  const newItalicValue = !format.italic;
                  quillRef.current.format('italic', newItalicValue);
                  // Update state immediately
                  setIsItalic(newItalicValue);
                } catch (error) {
                  console.error('Error toggling italic format:', error);
                }
              }
            }}
          >
            I
          </Button>
        </div>

        {/* Editor container */}
        <div
          id={id}
          data-testid={id}
          className={`quill-editor ${className || ''}`}
          ref={editorRef}
          aria-labelledby={label ? `editor-label-${id}` : undefined}
          aria-describedby={ariaDescription ? `editor-hint-${id}` : undefined}
          role="textbox"
          tabIndex={0}
          onClick={() => {
            // Focus the editor when clicking anywhere in the container
            if (quillRef.current) {
              try {
                quillRef.current.focus();
              } catch (error) {
                console.error('Error focusing Quill on click:', error);
              }
            }
          }}
          onKeyDown={(e) => {
            // Handle keyboard interaction - focus the editor on Enter
            if (e.key === 'Enter') {
              e.preventDefault();
              if (quillRef.current) {
                try {
                  quillRef.current.focus();
                } catch (error) {
                  console.error('Error focusing Quill on keydown:', error);
                }
              }
            }
          }}
        />
      </div>
    </div>
  );
}

const QuillEditor = forwardRef(_QuillEditor);
export default QuillEditor;
