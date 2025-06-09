import React, { forwardRef, useCallback, useImperativeHandle, useMemo } from 'react';
import { createEditor, Descendant, Editor, Transforms, Element as SlateElement, Path } from 'slate';
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

    switch (element.type) {
      case 'bulleted-list':
        return (
          <ul {...attributes} style={{ margin: 0, padding: '0 0 0 20px' }}>
            {children}
          </ul>
        );
      case 'numbered-list':
        return (
          <ol {...attributes} style={{ margin: 0, padding: '0 0 0 20px' }}>
            {children}
          </ol>
        );
      case 'list-item':
        return <li {...attributes}>{children}</li>;
      case 'list-item-text':
        return <div {...attributes}>{children}</div>;
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
            { type: 'list-item-text', children: [{ text: 'Item 1' }] },
            {
              type: 'bulleted-list',
              children: [
                {
                  type: 'list-item',
                  children: [{ type: 'list-item-text', children: [{ text: 'Nested item 1' }] }],
                },
              ],
            },
          ],
        },
        {
          type: 'list-item',
          children: [{ type: 'list-item-text', children: [{ text: 'Item 2' }] }],
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
    } else if (key === 'enter') {
      // Check if we're in a list item
      if (!editor.selection) return;

      // Find the closest list-item to the cursor
      const [listItemMatch] = Editor.nodes(editor, {
        at: editor.selection,
        match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'list-item',
        mode: 'lowest', // Get the deepest/closest match
      });

      if (listItemMatch) {
        event.preventDefault();

        const [listItemNode, listItemPath] = listItemMatch;

        // Check if the current list item is empty
        const isEmptyListItem = () => {
          if (!SlateElement.isElement(listItemNode)) return false;

          // Find the list-item-text child
          const listItemTextChild = listItemNode.children.find(
            (child) => SlateElement.isElement(child) && child.type === 'list-item-text',
          );

          if (!listItemTextChild || !SlateElement.isElement(listItemTextChild)) return false;

          // Check if all text nodes in list-item-text are empty
          return listItemTextChild.children.every(
            (child) => !SlateElement.isElement(child) && child.text.trim() === '',
          );
        };

        if (isEmptyListItem()) {
          // Check if this is the only list item in its parent list
          const parentListPath = Path.parent(listItemPath);
          const [parentListNode] = Editor.node(editor, parentListPath);

          const isOnlyListItem =
            SlateElement.isElement(parentListNode) && parentListNode.children.length === 1;

          if (isOnlyListItem) {
            // Replace the entire list with a paragraph
            const newParagraph: CustomElement = {
              type: 'paragraph',
              children: [{ text: '' }],
            };

            Transforms.removeNodes(editor, { at: parentListPath });
            Transforms.insertNodes(editor, newParagraph, { at: parentListPath });

            // Move cursor to the new paragraph
            const textNodePath = parentListPath.concat([0]);
            Transforms.select(editor, {
              anchor: { path: textNodePath, offset: 0 },
              focus: { path: textNodePath, offset: 0 },
            });
          } else {
            // Remove just the current empty list item and create paragraph after the top-most list
            Transforms.removeNodes(editor, { at: listItemPath });

            // Find the top-most list ancestor (direct child of editor)
            let topMostListPath = parentListPath;

            // Keep traversing up while we can find list ancestors
            while (true) {
              // Check if current list is a direct child of editor (path length = 1)
              if (topMostListPath.length === 1) {
                break; // This is the root-level list
              }

              // Look for the next list ancestor up the tree
              let currentPath = topMostListPath;
              let foundListAncestor = false;

              // Traverse up to find the next list
              while (currentPath.length > 1) {
                currentPath = Path.parent(currentPath);
                try {
                  const [currentNode] = Editor.node(editor, currentPath);

                  if (
                    SlateElement.isElement(currentNode) &&
                    (currentNode.type === 'bulleted-list' || currentNode.type === 'numbered-list')
                  ) {
                    topMostListPath = currentPath;
                    foundListAncestor = true;
                    break;
                  }
                } catch (_error) {
                  break;
                }
              }

              if (!foundListAncestor) {
                break; // No more list ancestors found
              }
            }

            // Insert paragraph after the top-most list (as direct child of editor)
            const topMostListIndex = topMostListPath[topMostListPath.length - 1];
            const insertionPath = [topMostListIndex + 1];

            // Create new paragraph
            const newParagraph: CustomElement = {
              type: 'paragraph',
              children: [{ text: '' }],
            };

            Transforms.insertNodes(editor, newParagraph, { at: insertionPath });

            // Move cursor to the new paragraph
            const textNodePath = insertionPath.concat([0]);
            Transforms.select(editor, {
              anchor: { path: textNodePath, offset: 0 },
              focus: { path: textNodePath, offset: 0 },
            });
          }
        } else {
          // Non-empty list item - split the text at cursor position
          const { selection } = editor;
          if (!selection) return;

          // Get the current text node and cursor position
          const { anchor } = selection;
          const currentTextPath = anchor.path;
          const cursorOffset = anchor.offset;

          // Get the current text node
          const [currentTextNode] = Editor.node(editor, currentTextPath);

          if (
            !currentTextNode ||
            SlateElement.isElement(currentTextNode) ||
            !('text' in currentTextNode)
          ) {
            // Fallback to empty list item if we can't find text node
            const newListItem: CustomElement = {
              type: 'list-item',
              children: [
                {
                  type: 'list-item-text',
                  children: [{ text: '' }],
                },
              ],
            };

            const nextPath = [...listItemPath];
            nextPath[nextPath.length - 1] += 1;
            Transforms.insertNodes(editor, newListItem, { at: nextPath });

            const textNodePath = nextPath.concat([0, 0]);
            Transforms.select(editor, {
              anchor: { path: textNodePath, offset: 0 },
              focus: { path: textNodePath, offset: 0 },
            });
            return;
          }

          // Split the text at cursor position
          const currentText = currentTextNode.text;
          const beforeCursor = currentText.slice(0, cursorOffset);
          const afterCursor = currentText.slice(cursorOffset);

          // Update the current text node with text before cursor
          Transforms.insertText(editor, beforeCursor, {
            at: {
              anchor: { path: currentTextPath, offset: 0 },
              focus: { path: currentTextPath, offset: currentText.length },
            },
          });

          // Create new list item with text after cursor
          const newListItem: CustomElement = {
            type: 'list-item',
            children: [
              {
                type: 'list-item-text',
                children: [{ text: afterCursor }],
              },
            ],
          };

          // Insert the new list item as a sibling after the current one
          const nextPath = [...listItemPath];
          nextPath[nextPath.length - 1] += 1;

          Transforms.insertNodes(editor, newListItem, { at: nextPath });

          // Move cursor to the beginning of the new list item
          const textNodePath = nextPath.concat([0, 0]);
          Transforms.select(editor, {
            anchor: { path: textNodePath, offset: 0 },
            focus: { path: textNodePath, offset: 0 },
          });
        }
      }
    } else if (key === 'tab') {
      event.preventDefault();
      if (event.shiftKey) {
        outdentListItem(editor);
      } else {
        indentListItem(editor);
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
