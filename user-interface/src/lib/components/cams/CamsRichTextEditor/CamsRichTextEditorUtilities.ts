import { Transforms, Editor, Descendant, Element as SlateElement, Path } from 'slate';
import { Mark, CustomEditor } from './CamsRichTextEditor.types';

export const toggleMark = (editor: Editor, format: Mark) => {
  const marks = Editor.marks(editor);
  const isActive = marks?.[format] === true;
  if (isActive) {
    editor.removeMark(format);
  } else {
    editor.addMark(format, true);
  }
};

export interface CamsRichTextEditorRef {
  toHtml: () => string;
  fromHtml: (value: string) => void;
}

export interface CamsRichTextEditorProps {
  onChange?: (value: Descendant[]) => void;
}

export const isListActive = (
  editor: CustomEditor,
  listType: 'bulleted-list' | 'numbered-list',
): boolean => {
  const [match] = Array.from(
    Editor.nodes(editor, {
      match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === listType,
    }),
  );
  return !!match;
};

export const unwrapList = (editor: Editor): void => {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      ['bulleted-list', 'numbered-list'].includes(n.type),
    split: true,
  });
};

export const toggleList = (editor: Editor, listType: 'bulleted-list' | 'numbered-list'): void => {
  const active = isListActive(editor, listType);
  unwrapList(editor);

  Transforms.setNodes<SlateElement>(editor, {
    type: active ? 'paragraph' : 'list-item',
  });

  if (!active) {
    const block: SlateElement = {
      type: listType,
      children: [],
    };
    Transforms.wrapNodes(editor, block);
  }
};

export function indentListItem(editor: Editor) {
  if (!editor.selection) {
    return;
  }

  const [listItemEntry] = Editor.nodes(editor, {
    at: editor.selection,
    match: (n) => SlateElement.isElement(n) && n.type === 'list-item',
  });

  if (!listItemEntry) {
    return;
  }

  const [listItemNode, listItemPath] = listItemEntry;

  // Guard: don't indent if first item in list
  if (listItemPath[listItemPath.length - 1] === 0) {
    return;
  }

  const prevSiblingPath = Path.previous(listItemPath);
  const [prevSiblingNode] = Editor.node(editor, prevSiblingPath);

  if (
    !prevSiblingNode ||
    !SlateElement.isElement(prevSiblingNode) ||
    prevSiblingNode.type !== 'list-item'
  ) {
    return;
  }

  Editor.withoutNormalizing(editor, () => {
    // Remove the original list item first
    Transforms.removeNodes(editor, { at: listItemPath });

    // Check if prevSiblingNode already has nested list as last child
    const lastChild = prevSiblingNode.children[prevSiblingNode.children.length - 1];

    if (!lastChild || !SlateElement.isElement(lastChild) || lastChild.type !== 'bulleted-list') {
      // Create new nested list node with the removed list item as child
      const newNestedListNode: SlateElement = {
        type: 'bulleted-list',
        children: [listItemNode],
      };

      // Insert new nested list node at end of prevSiblingNode's children
      Transforms.insertNodes(editor, newNestedListNode, {
        at: prevSiblingPath.concat([prevSiblingNode.children.length]),
      });
    } else {
      // Insert the removed list item into existing nested list
      Transforms.insertNodes(editor, listItemNode, {
        at: prevSiblingPath.concat([
          prevSiblingNode.children.length - 1,
          lastChild.children.length,
        ]),
      });
    }
  });
}

export const outdentListItem = (editor: Editor) => {
  const [match] = Editor.nodes(editor, {
    match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'list-item',
  });

  if (match) {
    const [_node, path] = match;
    const parentPath = Path.parent(path);
    const grandparentPath = Path.parent(parentPath);
    Transforms.moveNodes(editor, {
      at: path,
      to: Path.next(grandparentPath),
    });
    unwrapList(editor);
  }
};
