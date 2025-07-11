import { VDOMNode, VDOMSelection } from '../types';

export interface ToggleBoldResult {
  newVDOM: VDOMNode[];
  newSelection: VDOMSelection;
}

/**
 * Clones a VDOM node deeply
 */
function cloneNode(node: VDOMNode): VDOMNode {
  const cloned: VDOMNode = {
    type: node.type,
    path: [...node.path],
  };

  if (node.content !== undefined) {
    cloned.content = node.content;
  }

  if (node.children) {
    cloned.children = node.children.map(cloneNode);
  }

  if (node.attributes) {
    cloned.attributes = { ...node.attributes };
  }

  return cloned;
}

/**
 * Clones a VDOM array deeply
 */
function cloneVDOM(vdom: VDOMNode[]): VDOMNode[] {
  return vdom.map(cloneNode);
}

/**
 * Updates paths for all nodes in a subtree
 */
function updatePaths(node: VDOMNode, basePath: number[]): void {
  node.path = [...basePath];
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      updatePaths(node.children[i], [...basePath, i]);
    }
  }
}

/**
 * Finds a node by its path in the VDOM tree
 */
function findNodeByPath(vdom: VDOMNode[], targetPath: number[]): VDOMNode | null {
  if (targetPath.length === 0) return null;

  let current: VDOMNode[] = vdom;
  let node: VDOMNode | null = null;

  for (let i = 0; i < targetPath.length; i++) {
    const index = targetPath[i];
    if (index >= current.length) return null;

    node = current[index];
    if (i < targetPath.length - 1) {
      if (!node.children) return null;
      current = node.children;
    }
  }

  return node;
}

/**
 * Checks if a node is an ancestor of another node by path
 */
function isAncestorNode(ancestorNode: VDOMNode, descendantNode: VDOMNode): boolean {
  const ancestorPath = ancestorNode.path;
  const descendantPath = descendantNode.path;

  if (ancestorPath.length >= descendantPath.length) return false;

  for (let i = 0; i < ancestorPath.length; i++) {
    if (ancestorPath[i] !== descendantPath[i]) return false;
  }

  return true;
}

/**
 * Finds the nearest strong ancestor of a node
 */
function findStrongAncestor(node: VDOMNode, vdom: VDOMNode[]): VDOMNode | null {
  const allNodes = getAllNodes(vdom);

  for (const candidate of allNodes) {
    if (candidate.type === 'strong' && isAncestorNode(candidate, node)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Gets all nodes in the VDOM tree
 */
function getAllNodes(vdom: VDOMNode[]): VDOMNode[] {
  const nodes: VDOMNode[] = [];

  function traverse(nodeList: VDOMNode[]) {
    for (const node of nodeList) {
      nodes.push(node);
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(vdom);
  return nodes;
}

/**
 * Splits a text node at the given offsets, creating up to 3 nodes:
 * - before text (if startOffset > 0)
 * - selected text (startOffset to endOffset)
 * - after text (if endOffset < content.length)
 */
function splitTextNode(
  textNode: VDOMNode,
  startOffset: number,
  endOffset: number,
): { before?: VDOMNode; selected: VDOMNode; after?: VDOMNode } {
  if (textNode.type !== 'text' || !textNode.content) {
    throw new Error('Can only split text nodes');
  }

  const content = textNode.content;
  const beforeText = content.substring(0, startOffset);
  const selectedText = content.substring(startOffset, endOffset);
  const afterText = content.substring(endOffset);

  const result: { before?: VDOMNode; selected: VDOMNode; after?: VDOMNode } = {
    selected: {
      type: 'text',
      path: [...textNode.path],
      content: selectedText,
    },
  };

  if (beforeText) {
    result.before = {
      type: 'text',
      path: [...textNode.path],
      content: beforeText,
    };
  }

  if (afterText) {
    result.after = {
      type: 'text',
      path: [...textNode.path],
      content: afterText,
    };
  }

  return result;
}

/**
 * Wraps a node in a strong tag
 */
function wrapInStrong(node: VDOMNode, path: number[]): VDOMNode {
  return {
    type: 'strong',
    path,
    children: [
      {
        ...node,
        path: [...path, 0],
      },
    ],
  };
}

/**
 * Simple toggle bold implementation that handles partial text selections correctly
 */
export function toggleBoldSimple(vdom: VDOMNode[], selection: VDOMSelection): ToggleBoldResult {
  // For collapsed selections, just return unchanged (handle in FSM with toggle state)
  if (selection.isCollapsed) {
    return {
      newVDOM: vdom,
      newSelection: selection,
    };
  }

  const newVDOM = cloneVDOM(vdom);

  // Handle the simple case: selection within a single text node
  if (selection.start.node === selection.end.node && selection.start.node.type === 'text') {
    const textNode = findNodeByPath(newVDOM, selection.start.node.path);
    if (!textNode || textNode.type !== 'text') {
      return { newVDOM, newSelection: selection };
    }

    // Check if the text node is inside a strong node
    const strongAncestor = findStrongAncestor(textNode, newVDOM);

    if (strongAncestor) {
      // Case: removing bold from part of a strong node
      return removeBoldFromPartialSelection(newVDOM, textNode, selection, strongAncestor);
    } else {
      // Case: adding bold to part of a text node
      return addBoldToPartialSelection(newVDOM, textNode, selection);
    }
  }

  // For multi-node selections, fall back to the original logic for now
  // This would need more complex handling
  return {
    newVDOM: vdom,
    newSelection: selection,
  };
}

/**
 * Adds bold formatting to a partial selection within a text node
 */
function addBoldToPartialSelection(
  vdom: VDOMNode[],
  textNode: VDOMNode,
  selection: VDOMSelection,
): ToggleBoldResult {
  const startOffset = selection.start.offset;
  const endOffset = selection.end.offset;

  // Split the text node
  const { before, selected, after } = splitTextNode(textNode, startOffset, endOffset);

  // Find the parent container and the index of the text node
  const parentPath = textNode.path.slice(0, -1);
  const nodeIndex = textNode.path[textNode.path.length - 1];

  let parentContainer: VDOMNode[] | undefined;
  if (parentPath.length === 0) {
    parentContainer = vdom;
  } else {
    const parent = findNodeByPath(vdom, parentPath);
    parentContainer = parent?.children;
  }

  if (!parentContainer) {
    return { newVDOM: vdom, newSelection: selection };
  }

  // Create the replacement nodes
  const replacementNodes: VDOMNode[] = [];
  let newSelectionStart = selection.start;
  let newSelectionEnd = selection.end;

  if (before) {
    replacementNodes.push(before);
  }

  // Wrap the selected text in a strong node
  const strongNode = wrapInStrong(selected, [...parentPath, nodeIndex + replacementNodes.length]);
  replacementNodes.push(strongNode);

  // Update selection to point to the text inside the strong node
  newSelectionStart = { node: strongNode.children![0], offset: 0 };
  newSelectionEnd = { node: strongNode.children![0], offset: selected.content?.length || 0 };

  if (after) {
    replacementNodes.push(after);
  }

  // Replace the original text node with the split nodes
  parentContainer.splice(nodeIndex, 1, ...replacementNodes);

  // Update paths for all replacement nodes
  for (let i = 0; i < replacementNodes.length; i++) {
    updatePaths(replacementNodes[i], [...parentPath, nodeIndex + i]);
  }

  return {
    newVDOM: vdom,
    newSelection: {
      start: newSelectionStart,
      end: newSelectionEnd,
      isCollapsed: false,
    },
  };
}

/**
 * Removes bold formatting from a partial selection within a strong node
 */
function removeBoldFromPartialSelection(
  vdom: VDOMNode[],
  textNode: VDOMNode,
  selection: VDOMSelection,
  strongAncestor: VDOMNode,
): ToggleBoldResult {
  const startOffset = selection.start.offset;
  const endOffset = selection.end.offset;

  // Split the text node
  const { before, selected, after } = splitTextNode(textNode, startOffset, endOffset);

  // Find the strong node's parent and its index
  const strongParentPath = strongAncestor.path.slice(0, -1);
  const strongIndex = strongAncestor.path[strongAncestor.path.length - 1];

  let strongParentContainer: VDOMNode[] | undefined;
  if (strongParentPath.length === 0) {
    strongParentContainer = vdom;
  } else {
    const parent = findNodeByPath(vdom, strongParentPath);
    strongParentContainer = parent?.children;
  }

  if (!strongParentContainer) {
    return { newVDOM: vdom, newSelection: selection };
  }

  // Create the replacement nodes for the strong node
  const replacementNodes: VDOMNode[] = [];
  let newSelectionStart = selection.start;
  let newSelectionEnd = selection.end;

  if (before) {
    // Keep the before text in a strong node
    const beforeStrong = wrapInStrong(before, [...strongParentPath, strongIndex]);
    replacementNodes.push(beforeStrong);
  }

  // Add the selected text as a regular text node (unbolded)
  const unBoldSelected = {
    ...selected,
    path: [...strongParentPath, strongIndex + replacementNodes.length],
  };
  replacementNodes.push(unBoldSelected);

  // Update selection to point to the unbolded text
  newSelectionStart = { node: unBoldSelected, offset: 0 };
  newSelectionEnd = { node: unBoldSelected, offset: selected.content?.length || 0 };

  if (after) {
    // Keep the after text in a strong node
    const afterStrong = wrapInStrong(after, [
      ...strongParentPath,
      strongIndex + replacementNodes.length,
    ]);
    replacementNodes.push(afterStrong);
  }

  // Replace the strong node with the split nodes
  strongParentContainer.splice(strongIndex, 1, ...replacementNodes);

  // Update paths for all replacement nodes
  for (let i = 0; i < replacementNodes.length; i++) {
    updatePaths(replacementNodes[i], [...strongParentPath, strongIndex + i]);
  }

  return {
    newVDOM: vdom,
    newSelection: {
      start: newSelectionStart,
      end: newSelectionEnd,
      isCollapsed: false,
    },
  };
}
