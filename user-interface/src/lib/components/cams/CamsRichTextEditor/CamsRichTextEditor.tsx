import React, { forwardRef, useCallback, useImperativeHandle, useMemo } from 'react';
import { createEditor, Descendant, Editor } from 'slate';
import { Slate, withReact, Editable, RenderLeafProps, RenderElementProps } from 'slate-react';
import { withHistory } from 'slate-history';
import { htmlToSlate, slateToHtml } from '@slate-serializers/html';
import type { CustomText, CustomElement, Mark, CustomEditor } from './CamsRichTextEditor.types';
import {
  CamsRichTextEditorProps,
  CamsRichTextEditorRef,
  indentListItem,
  outdentListItem,
  toggleList,
  toggleMark,
} from './CamsRichTextEditorUtilities';

declare module 'slate' {
  interface CustomTypes {
    Editor: CustomEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

const _CamsRichTextEditor = (
  props: CamsRichTextEditorProps,
  ref: React.Ref<CamsRichTextEditorRef>,
) => {
  const editor: CustomEditor = useMemo(() => withHistory(withReact(createEditor())), []);

  const renderElement = useCallback((props: RenderElementProps) => {
    const { element, attributes, children } = props;

    setTimeout(() => {
      console.log(JSON.stringify(editor.children, null, 2));
    }, 300);
    switch (element.type) {
      case 'bulleted-list':
        return <ul {...attributes}>{children}</ul>;
      case 'numbered-list':
        return <ol {...attributes}>{children}</ol>;
      case 'list-item':
        return <li {...attributes}>{children}</li>;
      default:
        return <p {...attributes}>{children}</p>;
    }
  }, []);

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
    {
      type: 'bulleted-list',
      children: [
        {
          type: 'list-item',
          children: [
            { text: 'Item 1' },
            {
              type: 'bulleted-list',
              children: [
                {
                  type: 'list-item',
                  children: [{ text: 'Nested item 1' }],
                },
              ],
            },
          ],
        },
        {
          type: 'list-item',
          children: [{ text: 'Item 2' }],
        },
      ],
    },
  ];

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey) {
      let mark: Mark | undefined;
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
    } else if (key === 'tab') {
      event.preventDefault();
      if (event.shiftKey) {
        outdentListItem(editor);
      } else {
        console.log('Before indent', JSON.stringify(editor.children, null, 2));
        indentListItem(editor);
        console.log('After indent', JSON.stringify(editor.children, null, 2));
      }
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
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            toggleList(editor, 'bulleted-list');
          }}
        >
          • Bullet
        </button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            toggleList(editor, 'numbered-list');
          }}
        >
          1. Number
        </button>
      </div>
      <Editable
        className="cams-rich-text-editor"
        renderLeaf={renderLeaf}
        renderElement={renderElement}
        onKeyDown={handleKeyDown}
        placeholder="Type something and try bolding it..."
      />
    </Slate>
  );
};

const CamsRichTextEditor = forwardRef(_CamsRichTextEditor);

export default CamsRichTextEditor;
