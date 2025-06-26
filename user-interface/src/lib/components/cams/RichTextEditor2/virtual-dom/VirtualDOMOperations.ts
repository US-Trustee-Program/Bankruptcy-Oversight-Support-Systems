/**
 * Core virtual DOM manipulation operations for RichTextEditor2
 */

import { VNode, TextNode, isTextNode, isRootNode } from './VNode';
import { createTextNode } from './VNodeFactory';

/**
 * Update the depth of a node and all its descendants
 */
function updateNodeDepths(node: VNode, newDepth: number): void {
  node.depth = newDepth;

  for (const child of node.children) {
    updateNodeDepths(child, newDepth + 1);
  }
}

/**
 * Insert a node as a child of a parent node at the specified index
 */
export function insertNode(parent: VNode, child: VNode, index?: number): void {
  // Remove child from its current parent if it has one
  if (child.parent) {
    removeNode(child);
  }

  // Set new parent relationship
  child.parent = parent;

  // Update depth
  updateNodeDepths(child, parent.depth + 1);

  // Insert at specific index or append to end
  if (index !== undefined && index >= 0 && index <= parent.children.length) {
    parent.children.splice(index, 0, child);
  } else {
    parent.children.push(child);
  }
}

/**
 * Remove a node from its parent
 */
export function removeNode(node: VNode): VNode | null {
  // Cannot remove root node
  if (isRootNode(node) || !node.parent) {
    return null;
  }

  const parent = node.parent;
  const index = parent.children.indexOf(node);

  if (index === -1) {
    // Node not found in parent's children
    return null;
  }

  // Remove from parent's children
  parent.children.splice(index, 1);

  // Clear parent reference
  node.parent = null;

  return node;
}

/**
 * Replace an old node with a new node in the same position
 */
export function replaceNode(oldNode: VNode, newNode: VNode): VNode | null {
  // Cannot replace root node
  if (isRootNode(oldNode) || !oldNode.parent) {
    return null;
  }

  const parent = oldNode.parent;
  const index = parent.children.indexOf(oldNode);

  if (index === -1) {
    // Node not found in parent's children
    return null;
  }

  // Remove new node from its current parent if it has one
  if (newNode.parent) {
    removeNode(newNode);
  }

  // Set new parent relationship
  newNode.parent = parent;

  // Update depth
  updateNodeDepths(newNode, parent.depth + 1);

  // Replace in parent's children array
  parent.children[index] = newNode;

  // Clear old node's parent reference
  oldNode.parent = null;

  return oldNode;
}

/**
 * Move a node to a new parent at the specified index
 */
export function moveNode(node: VNode, newParent: VNode, index?: number): VNode | null {
  // Cannot move root node
  if (isRootNode(node)) {
    return null;
  }

  // Remove from current parent
  removeNode(node);

  // Insert into new parent
  insertNode(newParent, node, index);

  return node;
}

/**
 * Insert text content into a text node at the specified offset
 */
export function insertTextContent(textNode: TextNode, offset: number, content: string): TextNode {
  const currentContent = textNode.content;
  const validOffset = Math.max(0, Math.min(offset, currentContent.length));

  const newContent =
    currentContent.slice(0, validOffset) + content + currentContent.slice(validOffset);

  // Create updated text node
  const updatedNode: TextNode = {
    ...textNode,
    content: newContent,
    endOffset: textNode.startOffset + newContent.length,
  };

  // Update the original node properties
  textNode.content = newContent;
  textNode.endOffset = textNode.startOffset + newContent.length;

  return updatedNode;
}

/**
 * Remove text content from a text node
 */
export function removeTextContent(
  textNode: TextNode,
  startOffset: number,
  endOffset?: number,
): TextNode {
  const currentContent = textNode.content;
  const validStart = Math.max(0, Math.min(startOffset, currentContent.length));
  const validEnd =
    endOffset !== undefined
      ? Math.max(validStart, Math.min(endOffset, currentContent.length))
      : currentContent.length;

  const newContent = currentContent.slice(0, validStart) + currentContent.slice(validEnd);

  // Create updated text node
  const updatedNode: TextNode = {
    ...textNode,
    content: newContent,
    endOffset: textNode.startOffset + newContent.length,
  };

  // Update the original node properties
  textNode.content = newContent;
  textNode.endOffset = textNode.startOffset + newContent.length;

  return updatedNode;
}

/**
 * Split a text node at the specified offset into two text nodes
 */
export function splitTextNode(textNode: TextNode, offset: number): [TextNode, TextNode] {
  const currentContent = textNode.content;
  const validOffset = Math.max(0, Math.min(offset, currentContent.length));

  const leftContent = currentContent.slice(0, validOffset);
  const rightContent = currentContent.slice(validOffset);

  // Create left text node
  const leftNode = createTextNode(leftContent, {
    parent: textNode.parent,
    startOffset: textNode.startOffset,
    depth: textNode.depth,
  });

  // Create right text node
  const rightNode = createTextNode(rightContent, {
    parent: textNode.parent,
    startOffset: textNode.startOffset + leftContent.length,
    depth: textNode.depth,
  });

  // Replace original node with split nodes
  if (textNode.parent) {
    const parent = textNode.parent;
    const index = parent.children.indexOf(textNode);

    if (index !== -1) {
      // Remove original node
      parent.children.splice(index, 1);

      // Insert split nodes
      parent.children.splice(index, 0, leftNode, rightNode);
    }
  }

  return [leftNode, rightNode];
}

/**
 * Merge two adjacent text nodes into one
 */
export function mergeTextNodes(first: TextNode, second: TextNode): TextNode | null {
  // Must have same parent
  if (first.parent !== second.parent || !first.parent) {
    return null;
  }

  const parent = first.parent;
  const firstIndex = parent.children.indexOf(first);
  const secondIndex = parent.children.indexOf(second);

  // Must be adjacent
  if (Math.abs(firstIndex - secondIndex) !== 1) {
    return null;
  }

  // Determine order
  const [leftNode, rightNode] = firstIndex < secondIndex ? [first, second] : [second, first];
  const leftIndex = parent.children.indexOf(leftNode);

  // Create merged node
  const mergedContent = leftNode.content + rightNode.content;
  const mergedNode = createTextNode(mergedContent, {
    parent: parent,
    startOffset: leftNode.startOffset,
    depth: leftNode.depth,
  });

  // Replace both nodes with merged node
  parent.children.splice(leftIndex, 2, mergedNode);

  return mergedNode;
}

/**
 * Find the common ancestor of two nodes
 */
export function findCommonAncestor(node1: VNode, node2: VNode): VNode | null {
  // Get paths to root for both nodes
  const getPathToRoot = (node: VNode): VNode[] => {
    const path: VNode[] = [];
    let current: VNode | null = node;

    while (current) {
      path.unshift(current);
      current = current.parent;
    }

    return path;
  };

  const path1 = getPathToRoot(node1);
  const path2 = getPathToRoot(node2);

  // Find common ancestor by comparing paths
  let commonAncestor: VNode | null = null;
  const minLength = Math.min(path1.length, path2.length);

  for (let i = 0; i < minLength; i++) {
    if (path1[i] === path2[i]) {
      commonAncestor = path1[i];
    } else {
      break;
    }
  }

  return commonAncestor;
}

/**
 * Get all text nodes in document order from a subtree
 */
export function getTextNodesInOrder(root: VNode): TextNode[] {
  const textNodes: TextNode[] = [];

  function traverse(node: VNode): void {
    if (isTextNode(node)) {
      textNodes.push(node);
    }

    for (const child of node.children) {
      traverse(child);
    }
  }

  traverse(root);
  return textNodes;
}
