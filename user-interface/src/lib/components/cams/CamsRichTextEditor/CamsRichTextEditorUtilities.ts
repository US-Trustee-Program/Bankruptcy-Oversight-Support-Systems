import { Transforms, Editor, Descendant, Element as SlateElement, Path } from 'slate';
import { Mark, CustomEditor, CustomText } from './CamsRichTextEditor.types';

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
  if (!editor.selection) {
    return;
  }

  // Check if we're currently in a list item
  const [listItemMatch] = Editor.nodes(editor, {
    at: editor.selection,
    match: (n) => SlateElement.isElement(n) && n.type === 'list-item',
    mode: 'lowest',
  });

  if (listItemMatch) {
    // We're in a list - toggle OFF
    const [listItemNode, listItemPath] = listItemMatch;

    // Extract text content from the list item
    let textContent: CustomText[] = [{ text: '' }];
    if (SlateElement.isElement(listItemNode)) {
      const listItemTextChild = listItemNode.children.find(
        (child) => SlateElement.isElement(child) && child.type === 'list-item-text',
      );
      if (listItemTextChild && SlateElement.isElement(listItemTextChild)) {
        textContent = listItemTextChild.children as CustomText[];
      }
    }

    // Find the immediate parent list
    const parentListPath = Path.parent(listItemPath);
    const [parentListNode] = Editor.node(editor, parentListPath);

    if (!SlateElement.isElement(parentListNode)) {
      return;
    }

    const isOnlyItemInList = parentListNode.children.length === 1;

    Editor.withoutNormalizing(editor, () => {
      if (isOnlyItemInList) {
        // Check if the list-item being removed has nested lists as children
        let nestedListsFromRemovedItem: SlateElement[] = [];
        if (SlateElement.isElement(listItemNode)) {
          nestedListsFromRemovedItem = listItemNode.children.filter(
            (child) =>
              SlateElement.isElement(child) &&
              (child.type === 'bulleted-list' || child.type === 'numbered-list'),
          ) as SlateElement[];
        }

        // Remove the entire nested list (parentListPath)
        Transforms.removeNodes(editor, { at: parentListPath });

        // Always insert paragraph at the end of the editor root
        const insertionPath = [editor.children.length];

        const newParagraph: SlateElement = {
          type: 'paragraph',
          children: textContent,
        };

        Transforms.insertNodes(editor, newParagraph, { at: insertionPath });

        // Insert any nested lists that were children of the removed item
        let currentInsertIndex = insertionPath[0] + 1;

        for (const nestedList of nestedListsFromRemovedItem) {
          const nestedListPath = [currentInsertIndex];
          Transforms.insertNodes(editor, nestedList, { at: nestedListPath });
          currentInsertIndex++;
        }

        // Set cursor in the new paragraph
        const textNodePath = insertionPath.concat([0]);
        Transforms.select(editor, {
          anchor: { path: textNodePath, offset: 0 },
          focus: { path: textNodePath, offset: 0 },
        });
      } else {
        // Case: Multiple items in list - need to split the list properly
        const listItemIndex = listItemPath[listItemPath.length - 1];

        // Get all items after the one we're removing for potential splitting
        const [currentParentList] = Editor.node(editor, parentListPath);
        let itemsAfterRemoved: SlateElement[] = [];

        if (SlateElement.isElement(currentParentList)) {
          itemsAfterRemoved = currentParentList.children.slice(listItemIndex + 1) as SlateElement[];
        }

        // Check if the list-item being removed has nested lists as children
        let nestedListsFromRemovedItem: SlateElement[] = [];
        if (SlateElement.isElement(listItemNode)) {
          nestedListsFromRemovedItem = listItemNode.children.filter(
            (child) =>
              SlateElement.isElement(child) &&
              (child.type === 'bulleted-list' || child.type === 'numbered-list'),
          ) as SlateElement[];
        }

        // Remove the list item we're toggling off
        Transforms.removeNodes(editor, { at: listItemPath });

        // If there are items after the removed one, we need to split
        if (itemsAfterRemoved.length > 0) {
          // Remove the remaining items from the original list (they'll be re-added later)
          for (let i = itemsAfterRemoved.length - 1; i >= 0; i--) {
            const remainingItemPath = parentListPath.concat([listItemIndex + i]);
            Transforms.removeNodes(editor, { at: remainingItemPath });
          }
        }

        // Find where to insert the paragraph - right after the containing list-item
        let insertionPath: Path;

        // If the parent list is nested (parentListPath.length > 1), insert after its parent list-item
        if (parentListPath.length > 1) {
          const grandparentPath = Path.parent(parentListPath);
          const grandparentIndex = grandparentPath[grandparentPath.length - 1];
          const greatGrandparentPath = Path.parent(grandparentPath);
          insertionPath = greatGrandparentPath.concat([grandparentIndex + 1]);
        } else {
          // Top-level list, insert after it
          const parentListIndex = parentListPath[parentListPath.length - 1];
          insertionPath = [parentListIndex + 1];
        }

        // Create and insert the paragraph
        const newParagraph: SlateElement = {
          type: 'paragraph',
          children: textContent,
        };

        Transforms.insertNodes(editor, newParagraph, { at: insertionPath });

        // Insert any nested lists that were children of the removed item
        let currentInsertIndex = insertionPath[0] + 1;

        for (const nestedList of nestedListsFromRemovedItem) {
          const nestedListPath = [currentInsertIndex];
          Transforms.insertNodes(editor, nestedList, { at: nestedListPath });
          currentInsertIndex++;
        }

        // If we had items after the removed one, create a new list with them
        if (itemsAfterRemoved.length > 0) {
          const newList: SlateElement = {
            type: parentListNode.type as 'bulleted-list' | 'numbered-list',
            children: itemsAfterRemoved,
          };

          const newListPath = [currentInsertIndex];
          Transforms.insertNodes(editor, newList, { at: newListPath });
        }

        // Set cursor in the new paragraph
        const textNodePath = insertionPath.concat([0]);
        Transforms.select(editor, {
          anchor: { path: textNodePath, offset: 0 },
          focus: { path: textNodePath, offset: 0 },
        });
      }
    });
  } else {
    // We're not in a list - toggle ON
    const [currentNodeEntry] = Editor.nodes(editor, {
      match: (n) => !Editor.isEditor(n) && SlateElement.isElement(n),
    });

    if (currentNodeEntry) {
      const [currentNode] = currentNodeEntry;
      let textChildren: CustomText[];

      if (SlateElement.isElement(currentNode) && currentNode.type === 'paragraph') {
        textChildren = currentNode.children;
      } else {
        textChildren = [{ text: '' }];
      }

      const listItemWithText: SlateElement = {
        type: 'list-item',
        children: [
          {
            type: 'list-item-text',
            children: textChildren,
          },
        ],
      };

      const listBlock: SlateElement = {
        type: listType,
        children: [listItemWithText],
      };

      Transforms.removeNodes(editor);
      Transforms.insertNodes(editor, listBlock);
    }
  }
};

export function indentListItem(editor: Editor) {
  if (!editor.selection) {
    return;
  }

  // Find the closest list-item to the cursor (using 'lowest' mode for nested lists)
  const [listItemEntry] = Editor.nodes(editor, {
    at: editor.selection,
    match: (n) => SlateElement.isElement(n) && n.type === 'list-item',
    mode: 'lowest',
  });

  if (!listItemEntry) {
    return;
  }

  const [listItemNode, listItemPath] = listItemEntry;

  // Guard: don't indent if first item in its immediate parent list
  if (listItemPath[listItemPath.length - 1] === 0) {
    return;
  }

  // Capture current selection offset within the list item
  const currentSelection = editor.selection;
  const selectionOffset = currentSelection.anchor.offset;
  const selectionPath = currentSelection.anchor.path;

  // Calculate the relative path within the list item (path after the list-item level)
  const relativeSelectionPath = selectionPath.slice(listItemPath.length);

  const prevSiblingPath = Path.previous(listItemPath);

  let prevSiblingNode;
  try {
    [prevSiblingNode] = Editor.node(editor, prevSiblingPath);

    if (
      !prevSiblingNode ||
      !SlateElement.isElement(prevSiblingNode) ||
      prevSiblingNode.type !== 'list-item'
    ) {
      return;
    }
  } catch (_error) {
    return;
  }

  // Find the parent list to determine the list type for nesting
  const parentListPath = Path.parent(listItemPath);
  const [parentListNode] = Editor.node(editor, parentListPath);
  const parentListType =
    SlateElement.isElement(parentListNode) &&
    (parentListNode.type === 'bulleted-list' || parentListNode.type === 'numbered-list')
      ? parentListNode.type
      : 'bulleted-list';

  Editor.withoutNormalizing(editor, () => {
    // Remove the original list item first
    Transforms.removeNodes(editor, { at: listItemPath });

    // Validate that listItemNode is properly structured
    if (!SlateElement.isElement(listItemNode) || listItemNode.type !== 'list-item') {
      return;
    }

    // Check if prevSiblingNode already has nested list as last child
    const lastChild = prevSiblingNode.children[prevSiblingNode.children.length - 1];

    let newListItemPath: Path;

    if (
      !lastChild ||
      !SlateElement.isElement(lastChild) ||
      (lastChild.type !== 'bulleted-list' && lastChild.type !== 'numbered-list')
    ) {
      // Create new nested list node with the removed list item as child
      // Use the same type as the parent list
      const newNestedListNode: SlateElement = {
        type: parentListType,
        children: [listItemNode],
      };

      const insertionPath = prevSiblingPath.concat([prevSiblingNode.children.length]);
      // Insert new nested list node at end of prevSiblingNode's children
      Transforms.insertNodes(editor, newNestedListNode, {
        at: insertionPath,
      });

      // The list item is now at insertionPath -> 0 (first child of the new list)
      newListItemPath = insertionPath.concat([0]);
    } else {
      const insertionPath = prevSiblingPath.concat([
        prevSiblingNode.children.length - 1,
        lastChild.children.length,
      ]);

      // Insert the removed list item into existing nested list
      Transforms.insertNodes(editor, listItemNode, {
        at: insertionPath,
      });

      newListItemPath = insertionPath;
    }

    // Restore cursor position in the new location
    const newSelectionPath = newListItemPath.concat(relativeSelectionPath);
    Transforms.select(editor, {
      anchor: { path: newSelectionPath, offset: selectionOffset },
      focus: { path: newSelectionPath, offset: selectionOffset },
    });
  });
}

export const outdentListItem = (editor: Editor) => {
  if (!editor.selection) {
    return;
  }

  // Find the closest list-item to the cursor (using 'lowest' mode for nested lists)
  const [listItemEntry] = Editor.nodes(editor, {
    at: editor.selection,
    match: (n) => SlateElement.isElement(n) && n.type === 'list-item',
    mode: 'lowest',
  });

  if (!listItemEntry) {
    return;
  }

  const [listItemNode, listItemPath] = listItemEntry;

  // Capture current selection offset within the list item
  const currentSelection = editor.selection;
  const selectionOffset = currentSelection.anchor.offset;
  const selectionPath = currentSelection.anchor.path;

  // Calculate the relative path within the list item (path after the list-item level)
  const relativeSelectionPath = selectionPath.slice(listItemPath.length);

  // Find the parent list and grandparent
  const parentListPath = Path.parent(listItemPath);
  const grandparentPath = Path.parent(parentListPath);

  let grandparentNode;
  try {
    [grandparentNode] = Editor.node(editor, grandparentPath);
  } catch (_error) {
    return;
  }

  Editor.withoutNormalizing(editor, () => {
    // Remove the original list item first
    // Validate that listItemNode is properly structured
    if (!SlateElement.isElement(listItemNode) || listItemNode.type !== 'list-item') {
      return;
    }

    // Check if this is the only item in its parent list
    const [parentListNode] = Editor.node(editor, parentListPath);
    const isOnlyItemInList =
      SlateElement.isElement(parentListNode) && parentListNode.children.length === 1;

    Transforms.removeNodes(editor, { at: listItemPath });

    // If this was the only item in the list, remove the empty list container too
    if (isOnlyItemInList) {
      Transforms.removeNodes(editor, { at: parentListPath });
    }

    let newListItemPath: Path;

    if (SlateElement.isElement(grandparentNode) && grandparentNode.type === 'list-item') {
      // We're outdenting from a nested list to a parent list
      // Find the parent list (great-grandparent) and insert after the grandparent list-item
      const greatGrandparentPath = Path.parent(grandparentPath);

      try {
        const [greatGrandparentNode] = Editor.node(editor, greatGrandparentPath);

        if (
          SlateElement.isElement(greatGrandparentNode) &&
          (greatGrandparentNode.type === 'bulleted-list' ||
            greatGrandparentNode.type === 'numbered-list')
        ) {
          // Insert into the parent list after the grandparent list-item
          const insertionIndex = grandparentPath[grandparentPath.length - 1] + 1;
          newListItemPath = greatGrandparentPath.concat([insertionIndex]);

          Transforms.insertNodes(editor, listItemNode, { at: newListItemPath });
        } else {
          return;
        }
      } catch (_error) {
        return;
      }
    } else {
      // We're outdenting from the top-level list - convert to paragraph
      const listItemTextNode =
        SlateElement.isElement(listItemNode) &&
        listItemNode.children.length > 0 &&
        SlateElement.isElement(listItemNode.children[0]) &&
        listItemNode.children[0].type === 'list-item-text'
          ? listItemNode.children[0]
          : null;

      if (listItemTextNode && SlateElement.isElement(listItemTextNode)) {
        const paragraphNode: SlateElement = {
          type: 'paragraph',
          children: listItemTextNode.children,
        };

        // Insert after the top-level list
        const insertionIndex = parentListPath[parentListPath.length - 1] + 1;
        const rootPath = parentListPath.slice(0, -1);
        newListItemPath = rootPath.concat([insertionIndex]);

        Transforms.insertNodes(editor, paragraphNode, { at: newListItemPath });

        // For paragraph conversion, we need to adjust the cursor path
        // The structure changes from list-item > list-item-text > text to paragraph > text
        // So we need to remove one level from the relative path
        let adjustedSelectionPath;
        if (relativeSelectionPath.length >= 2) {
          // Remove the list-item-text level (index 0) from the path
          adjustedSelectionPath = newListItemPath.concat(relativeSelectionPath.slice(1));
        } else {
          // Fallback to the beginning of the paragraph
          adjustedSelectionPath = newListItemPath.concat([0]);
        }

        try {
          Transforms.select(editor, {
            anchor: { path: adjustedSelectionPath, offset: selectionOffset },
            focus: { path: adjustedSelectionPath, offset: selectionOffset },
          });
        } catch (_error) {
          // Fallback: place cursor at the beginning of the new paragraph
          Transforms.select(editor, {
            anchor: { path: newListItemPath.concat([0]), offset: 0 },
            focus: { path: newListItemPath.concat([0]), offset: 0 },
          });
        }
        return; // Return early since we handled cursor positioning above
      } else {
        return;
      }
    }

    // Restore cursor position in the new location (for list-to-list outdenting)
    try {
      const newSelectionPath = newListItemPath.concat(relativeSelectionPath);
      Transforms.select(editor, {
        anchor: { path: newSelectionPath, offset: selectionOffset },
        focus: { path: newSelectionPath, offset: selectionOffset },
      });
    } catch (_error) {
      // Fallback: place cursor at the beginning of the new list item
      const fallbackPath = newListItemPath.concat([0, 0]); // list-item > list-item-text > text
      Transforms.select(editor, {
        anchor: { path: fallbackPath, offset: 0 },
        focus: { path: fallbackPath, offset: 0 },
      });
    }
  });
};
