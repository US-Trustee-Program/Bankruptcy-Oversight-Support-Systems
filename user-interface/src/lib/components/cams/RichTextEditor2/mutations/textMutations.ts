import { EditorState, SelectionState } from '../types';
import { VNode, TextNode, isTextNode, RootNode } from '../virtual-dom/VNode';
import { VirtualDOMTree } from '../virtual-dom/VirtualDOMTree';

/**
 * Creates a new VDOM tree by replacing a node and recursively cloning its ancestors
 * up to the root. This is the core utility for maintaining immutability during mutations.
 *
 * @param leafNode - The new node that will replace its counterpart in the original tree.
 * @param path - The ancestor path from the root to the original node's parent.
 * @returns The new root of the immutably updated VDOM tree.
 */
function immutablyReplaceNodeInPath(leafNode: VNode, path: VNode[]): RootNode {
  let newChild = leafNode;

  for (let i = path.length - 1; i >= 0; i--) {
    const parent = path[i];
    const newChildren = parent.children.map((child) =>
      child.id === newChild.id ? newChild : child,
    );

    const newParent = {
      ...parent,
      children: newChildren,
    };
    // Re-establish parent link for the new child
    newChildren.forEach((c) => (c.parent = newParent as VNode));

    newChild = newParent;
  }

  return newChild as RootNode;
}

/**
 * Inserts text into a text node within the EditorState, returning a new state.
 *
 * @param state - The current EditorState.
 * @param textToInsert - The string to insert.
 * @returns A new EditorState with the text inserted.
 */
export function insertText(state: EditorState, textToInsert: string): EditorState {
  const { vdom, selection } = state;
  if (!selection.isCollapsed) {
    // For now, only handle collapsed selections (cursors).
    // Deleting the selection before insertion will be a separate mutation.
    return state;
  }

  const tree = new VirtualDOMTree(vdom);
  const targetNode = tree.findNodeById(selection.anchorNode.id);

  if (!targetNode || !isTextNode(targetNode)) {
    return state;
  }

  const { anchorOffset } = selection;
  const newContent =
    targetNode.content.slice(0, anchorOffset) +
    textToInsert +
    targetNode.content.slice(anchorOffset);

  const newTextNode: TextNode = {
    ...targetNode,
    content: newContent,
  };

  const pathToNode = tree.getNodePath(targetNode);
  pathToNode.pop(); // We only want the path to the parent

  const newRoot = immutablyReplaceNodeInPath(newTextNode, pathToNode);

  // TODO: Recalculate all VNode offsets in the new tree.

  // Find the actual text node in the new tree to ensure selection references are correct
  const newTree = new VirtualDOMTree(newRoot);
  const actualNewTextNode = newTree.findNodeById(newTextNode.id);

  const newSelection: SelectionState = {
    anchorNode: actualNewTextNode as TextNode,
    anchorOffset: anchorOffset + textToInsert.length,
    focusNode: actualNewTextNode as TextNode,
    focusOffset: anchorOffset + textToInsert.length,
    isCollapsed: true,
  };

  return {
    vdom: newRoot,
    selection: newSelection,
  };
}

/**
 * Deletes content backward from the cursor position, returning a new state.
 *
 * @param state - The current EditorState.
 * @returns A new EditorState with the content deleted.
 */
export function deleteContentBackward(state: EditorState): EditorState {
  const { vdom, selection } = state;
  if (!selection.isCollapsed) {
    // For now, only handle collapsed selections (cursors).
    // Deleting a range is a separate, more complex mutation.
    return state;
  }

  const tree = new VirtualDOMTree(vdom);
  const targetNode = tree.findNodeById(selection.anchorNode.id);

  if (!targetNode || !isTextNode(targetNode) || selection.anchorOffset === 0) {
    // For now, do not handle merging paragraphs.
    return state;
  }

  const { anchorOffset } = selection;
  const newContent =
    targetNode.content.slice(0, anchorOffset - 1) + targetNode.content.slice(anchorOffset);

  const newTextNode: TextNode = {
    ...targetNode,
    content: newContent,
  };

  const pathToNode = tree.getNodePath(targetNode);
  pathToNode.pop(); // We only want the path to the parent

  const newRoot = immutablyReplaceNodeInPath(newTextNode, pathToNode);

  // TODO: Recalculate all VNode offsets in the new tree.

  // Find the actual text node in the new tree to ensure selection references are correct
  const newTree = new VirtualDOMTree(newRoot);
  const actualNewTextNode = newTree.findNodeById(newTextNode.id);

  const newSelection: SelectionState = {
    anchorNode: actualNewTextNode as TextNode,
    anchorOffset: anchorOffset - 1,
    focusNode: actualNewTextNode as TextNode,
    focusOffset: anchorOffset - 1,
    isCollapsed: true,
  };

  return {
    vdom: newRoot,
    selection: newSelection,
  };
}
