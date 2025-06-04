import React, { forwardRef, useCallback, useImperativeHandle, useMemo } from 'react';
import { createEditor, Descendant, Editor } from 'slate';
import { Slate, withReact, Editable, RenderLeafProps } from 'slate-react';
import { withHistory } from 'slate-history';
import { htmlToSlate, slateToHtml } from '@slate-serializers/html';
import { CustomText, CustomElement, Mark, CustomEditor } from './camsRichTextEditor.d';

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

const toggleMark = (editor: Editor, format: Mark) => {
  const marks = Editor.marks(editor);
  const isActive = marks?.[format] === true;
  if (isActive) {
    editor.removeMark(format);
  } else {
    editor.addMark(format, true);
  }
};

const getCurrentContents = (editor: Editor) => {
  const contents = editor.children;
  console.log(contents);
};

export interface CamsRichTextEditorRef {
  toHtml: () => string;
  fromHtml: (value: string) => void;
}

export interface CamsRichTextEditorProps {
  onChange?: (value: Descendant[]) => void;
}

const _CamsRichTextEditor = (
  props: CamsRichTextEditorProps,
  ref: React.Ref<CamsRichTextEditorRef>,
) => {
  const editor: CustomEditor = useMemo(() => withHistory(withReact(createEditor())), []);

  const renderLeaf = useCallback((props: RenderLeafProps) => {
    const { attributes, children, leaf } = props;

    let el = children;
    if (leaf.bold) el = <strong>{el}</strong>;
    if (leaf.italic) el = <em>{el}</em>;
    if (leaf.underline) el = <u>{el}</u>;

    return <span {...attributes}>{el}</span>;
  }, []);

  const initialValue: Descendant[] = [
    {
      type: 'paragraph',
      children: [{ text: 'Press Ctrl+B (or Cmd+B on Mac) to bold text.' }],
    },
  ];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    getCurrentContents(editor);

    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    let mark: Mark | undefined;

    const key = event.key.toLowerCase();

    if (key === 'b') {
      mark = 'bold';
    } else if (key === 'i') {
      mark = 'italic';
    } else if (key === 'u') {
      mark = 'underline';
    }

    if (mark) {
      toggleMark(editor, mark);
      event.preventDefault();
    }
  };

  const isMarkActive = (format: Mark) => {
    const marks = Editor.marks(editor);
    return marks?.[format] === true;
  };

  const toHtml = (): string => {
    return slateToHtml(editor.children);
  };

  const fromHtml = (value: string): void => {
    editor.children = htmlToSlate(value);
  };

  useImperativeHandle(ref, () => {
    return {
      toHtml,
      fromHtml,
    };
  });

  return (
    <Slate editor={editor} initialValue={initialValue} onChange={props.onChange ?? undefined}>
      <div
        style={{
          display: 'flex',
          gap: '4px',
          padding: '8px',
          borderBottom: '1px solid #e0e0e0',
          marginBottom: '8px',
          backgroundColor: '#f9f9f9',
        }}
      >
        <button
          onClick={() => toggleMark(editor, 'bold')}
          style={{
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: isMarkActive('bold') ? '#e3f2fd' : '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'normal',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isMarkActive('bold')) {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMarkActive('bold')) {
              e.currentTarget.style.backgroundColor = '#fff';
            }
          }}
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => toggleMark(editor, 'italic')}
          style={{
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: isMarkActive('italic') ? '#e3f2fd' : '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'normal',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isMarkActive('italic')) {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMarkActive('italic')) {
              e.currentTarget.style.backgroundColor = '#fff';
            }
          }}
        >
          <em>I</em>
        </button>
        <button
          onClick={() => toggleMark(editor, 'underline')}
          style={{
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: isMarkActive('underline') ? '#e3f2fd' : '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'normal',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            if (!isMarkActive('underline')) {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            if (!isMarkActive('underline')) {
              e.currentTarget.style.backgroundColor = '#fff';
            }
          }}
        >
          <u>U</u>
        </button>
      </div>
      <Editable
        className="cams-rich-text-editor"
        renderLeaf={renderLeaf}
        onKeyDown={handleKeyDown}
        placeholder="Type something and try bolding it..."
      />
    </Slate>
  );
};

const CamsRichTextEditor = forwardRef(_CamsRichTextEditor);

export default CamsRichTextEditor;
