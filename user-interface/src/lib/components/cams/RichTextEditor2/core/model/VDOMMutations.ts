import { VDOMNode, VDOMSelection, VDOMPosition } from '../types';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';
import { createTextNode } from './VDOMNode';

/**
 * Result type for mutation operations
 */
export interface MutationResult {
  newVDOM: VDOMNode[];
  newSelection: VDOMSelection;
}

/**
 * Gets the text length of a node (only for text nodes)
 */
export function getTextLength(node: VDOMNode): number {
  if (node.type === 'text' && node.content !== undefined) {
    return node.content.length;
  }
  return 0;
}

/**
 * Deep clones a VDOM node
 */
function cloneNode(node: VDOMNode): VDOMNode {
  const cloned: VDOMNode = {
    type: node.type,
    path: [...node.path], // Clone the path array
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
 * Deep clones a VDOM array
 */
function cloneVDOM(vdom: VDOMNode[]): VDOMNode[] {
  return vdom.map(cloneNode);
}

/**
 * Finds the parent node and index of a child node by path
 */
function findParentAndIndex(
  vdom: VDOMNode[],
  targetPath: number[],
): { parent: VDOMNode | null; index: number } | null {
  // If path has only one element, it's a root level node
  if (targetPath.length === 1) {
    const index = targetPath[0];
    if (index >= 0 && index < vdom.length) {
      return { parent: null, index }; // Parent is null for root level nodes
    }
    return null;
  }

  // Navigate to the parent using the path (all elements except the last)
  const parentPath = targetPath.slice(0, -1);
  const childIndex = targetPath[targetPath.length - 1];

  const parentNode = findNodeByPath(vdom, parentPath);
  if (
    parentNode &&
    parentNode.children &&
    childIndex >= 0 &&
    childIndex < parentNode.children.length
  ) {
    return { parent: parentNode, index: childIndex };
  }

  return null;
}

/**
 * Inserts text at the specified selection, replacing any selected content
 */
export function insertText(
  vdom: VDOMNode[],
  selection: VDOMSelection,
  text: string,
): MutationResult {
  const newVDOM = cloneVDOM(vdom);
  const targetNode = findNodeByPath(newVDOM, selection.start.node.path);

  if (!targetNode || targetNode.type !== 'text') {
    return { newVDOM, newSelection: selection };
  }

  const currentContent = targetNode.content || '';
  const startOffset = selection.start.offset;
  const endOffset = selection.isCollapsed ? startOffset : selection.end.offset;

  // Handle zero-width space replacement
  let actualStartOffset = startOffset;
  let actualEndOffset = endOffset;

  if (currentContent === ZERO_WIDTH_SPACE) {
    actualStartOffset = 0;
    actualEndOffset = 1;
  }

  // Insert text by replacing the selected range
  const beforeText = currentContent.substring(0, actualStartOffset);
  const afterText = currentContent.substring(actualEndOffset);
  const newContent = beforeText + text + afterText;

  targetNode.content = newContent;

  // Update selection to be at the end of the inserted text
  const newOffset = actualStartOffset + text.length;
  const newSelection: VDOMSelection = {
    start: { node: targetNode, offset: newOffset },
    end: { node: targetNode, offset: newOffset },
    isCollapsed: true,
  };

  return { newVDOM, newSelection };
}

/**
 * Deletes content in the specified selection range
 */
export function deleteContent(vdom: VDOMNode[], selection: VDOMSelection): MutationResult {
  const newVDOM = cloneVDOM(vdom);

  if (selection.isCollapsed) {
    // Handle backspace behavior - delete one character before cursor
    const targetNode = findNodeByPath(newVDOM, selection.start.node.path);
    if (!targetNode || targetNode.type !== 'text' || selection.start.offset === 0) {
      return { newVDOM, newSelection: selection };
    }

    const currentContent = targetNode.content || '';
    const newOffset = Math.max(0, selection.start.offset - 1);
    const beforeText = currentContent.substring(0, newOffset);
    const afterText = currentContent.substring(selection.start.offset);

    targetNode.content = beforeText + afterText;

    const newSelection: VDOMSelection = {
      start: { node: targetNode, offset: newOffset },
      end: { node: targetNode, offset: newOffset },
      isCollapsed: true,
    };

    return { newVDOM, newSelection };
  }

  // Handle range deletion
  const targetNode = findNodeByPath(newVDOM, selection.start.node.path);
  if (!targetNode || targetNode.type !== 'text') {
    return { newVDOM, newSelection: selection };
  }

  const currentContent = targetNode.content || '';
  const startOffset = selection.start.offset;
  const endOffset = selection.end.offset;

  const beforeText = currentContent.substring(0, startOffset);
  const afterText = currentContent.substring(endOffset);
  let newContent = beforeText + afterText;

  // If the entire content is deleted, replace with zero-width space
  if (newContent === '') {
    newContent = ZERO_WIDTH_SPACE;
  }

  targetNode.content = newContent;

  const newSelection: VDOMSelection = {
    start: { node: targetNode, offset: startOffset },
    end: { node: targetNode, offset: startOffset },
    isCollapsed: true,
  };

  return { newVDOM, newSelection };
}

/**
 * Splits a text node at the specified position
 */
export function splitNode(vdom: VDOMNode[], position: VDOMPosition): MutationResult {
  const newVDOM = cloneVDOM(vdom);
  const targetNode = findNodeByPath(newVDOM, position.node.path);

  if (!targetNode || targetNode.type !== 'text') {
    return {
      newVDOM,
      newSelection: {
        start: position,
        end: position,
        isCollapsed: true,
      },
    };
  }

  const parentInfo = findParentAndIndex(newVDOM, position.node.path);
  if (!parentInfo) {
    return {
      newVDOM,
      newSelection: {
        start: position,
        end: position,
        isCollapsed: true,
      },
    };
  }

  const currentContent = targetNode.content || '';
  const splitOffset = position.offset;

  // Create two new text nodes
  const beforeText = currentContent.substring(0, splitOffset);
  const afterText = currentContent.substring(splitOffset);

  const firstNode = createTextNode(beforeText);
  const secondNode = createTextNode(afterText);

  // Update paths for the new nodes
  firstNode.path = [...targetNode.path];
  secondNode.path = [...targetNode.path];
  secondNode.path[secondNode.path.length - 1] += 1; // Next sibling position

  // Replace the original node with the two new nodes
  if (parentInfo.parent && parentInfo.parent.children) {
    parentInfo.parent.children.splice(parentInfo.index, 1, firstNode, secondNode);
  } else {
    // Root level node
    newVDOM.splice(parentInfo.index, 1, firstNode, secondNode);
  }

  // Set selection to the beginning of the second node
  const newSelection: VDOMSelection = {
    start: { node: secondNode, offset: 0 },
    end: { node: secondNode, offset: 0 },
    isCollapsed: true,
  };

  return { newVDOM, newSelection };
}

/**
 * Merges two adjacent text nodes
 */
export function mergeNodes(
  vdom: VDOMNode[],
  firstNodePath: number[],
  secondNodePath: number[],
): MutationResult {
  const newVDOM = cloneVDOM(vdom);
  const firstNode = findNodeByPath(newVDOM, firstNodePath);
  const secondNode = findNodeByPath(newVDOM, secondNodePath);

  if (!firstNode || !secondNode || firstNode.type !== 'text' || secondNode.type !== 'text') {
    // Create a fallback node for the error case
    const fallbackNode = firstNode || { type: 'text' as const, path: firstNodePath, content: '' };
    return {
      newVDOM,
      newSelection: {
        start: { node: fallbackNode, offset: 0 },
        end: { node: fallbackNode, offset: 0 },
        isCollapsed: true,
      },
    };
  }

  const firstContent = firstNode.content || '';
  const secondContent = secondNode.content || '';

  // Handle zero-width space merging
  let mergedContent: string;
  let mergeOffset: number;

  if (firstContent === ZERO_WIDTH_SPACE) {
    mergedContent = secondContent;
    mergeOffset = 0;
  } else if (secondContent === ZERO_WIDTH_SPACE) {
    mergedContent = firstContent;
    mergeOffset = firstContent.length;
  } else {
    mergedContent = firstContent + secondContent;
    mergeOffset = firstContent.length;
  }

  // Update the first node with merged content
  firstNode.content = mergedContent;

  // Remove the second node from its parent
  const secondParentInfo = findParentAndIndex(newVDOM, secondNodePath);
  if (secondParentInfo) {
    if (secondParentInfo.parent && secondParentInfo.parent.children) {
      secondParentInfo.parent.children.splice(secondParentInfo.index, 1);
    } else {
      // Root level node
      newVDOM.splice(secondParentInfo.index, 1);
    }
  }

  const newSelection: VDOMSelection = {
    start: { node: firstNode, offset: mergeOffset },
    end: { node: firstNode, offset: mergeOffset },
    isCollapsed: true,
  };

  return { newVDOM, newSelection };
}

/**
 * Removes empty formatting containers from the VDOM
 * This is called after deletion operations to clean up containers that no longer have content
 */
export function removeEmptyFormattingContainers(vdom: VDOMNode[]): VDOMNode[] {
  const result: VDOMNode[] = [];

  for (const node of vdom) {
    if (node.type === 'text') {
      // Keep text nodes (even empty ones for now, they might have zero-width space)
      result.push(node);
    } else if (node.children) {
      // Recursively clean children first
      const cleanedChildren = removeEmptyFormattingContainers(node.children);

      // Only keep the container if it has non-empty children
      if (cleanedChildren.length > 0 && !isContainerEffectivelyEmpty(cleanedChildren)) {
        result.push({
          ...node,
          children: cleanedChildren,
        });
      }
      // If container is empty, don't add it to result (effectively removing it)
    } else {
      // Keep non-text nodes without children (like br tags)
      result.push(node);
    }
  }

  return result;
}

/**
 * Checks if a container is effectively empty (contains only empty text nodes or zero-width spaces)
 */
function isContainerEffectivelyEmpty(children: VDOMNode[]): boolean {
  return children.every((child) => {
    if (child.type === 'text') {
      const content = child.content || '';
      return content === '' || content === ZERO_WIDTH_SPACE;
    }
    if (child.children) {
      return isContainerEffectivelyEmpty(child.children);
    }
    return false; // Non-text nodes without children are not considered empty
  });
}

/**
 * Merges adjacent text nodes in the VDOM
 * This is called after deletion operations that might create adjacent text nodes
 */
export function mergeAdjacentTextNodes(vdom: VDOMNode[]): VDOMNode[] {
  const result: VDOMNode[] = [];
  let lastTextNode: VDOMNode | null = null;

  for (const node of vdom) {
    if (node.type === 'text') {
      if (lastTextNode) {
        // Merge with previous text node
        lastTextNode.content = (lastTextNode.content || '') + (node.content || '');
      } else {
        // Start a new text sequence
        lastTextNode = cloneNode(node);
        result.push(lastTextNode);
      }
    } else {
      // Non-text node breaks the text sequence
      lastTextNode = null;

      if (node.children) {
        // Recursively merge children
        result.push({
          ...node,
          children: mergeAdjacentTextNodes(node.children),
        });
      } else {
        result.push(cloneNode(node));
      }
    }
  }

  return result;
}

/**
 * Finds a node by its path in the VDOM tree
 */
function findNodeByPath(vdom: VDOMNode[], targetPath: number[]): VDOMNode | null {
  function traverse(nodes: VDOMNode[]): VDOMNode | null {
    for (const node of nodes) {
      if (pathsEqual(node.path, targetPath)) {
        return node;
      }
      if (node.children) {
        const found = traverse(node.children);
        if (found) return found;
      }
    }
    return null;
  }
  return traverse(vdom);
}

/**
 * Checks if two paths are equal
 */
function pathsEqual(path1: number[], path2: number[]): boolean {
  if (path1.length !== path2.length) return false;
  return path1.every((value, index) => value === path2[index]);
}

/**
 * Finds the nearest valid text node position after cleanup operations
 * Uses path proximity to determine the best replacement position
 */
function findNearestValidPosition(
  vdom: VDOMNode[],
  originalPath: number[],
  originalOffset: number,
): VDOMSelection {
  // Get all text nodes in the cleaned VDOM
  const allTextNodes = getAllTextNodesWithPaths(vdom);

  if (allTextNodes.length === 0) {
    // No text nodes available, create a fallback
    return createFallbackSelection();
  }

  // Find the text node with the closest path
  let bestNode = allTextNodes[0];
  let bestDistance = calculatePathDistance(originalPath, bestNode.path);

  for (const textNode of allTextNodes) {
    const distance = calculatePathDistance(originalPath, textNode.path);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestNode = textNode;
    }
  }

  // Calculate the best offset within the chosen node
  const nodeContentLength = bestNode.content?.length || 0;
  const clampedOffset = Math.min(originalOffset, nodeContentLength);

  return {
    start: { node: bestNode, offset: clampedOffset },
    end: { node: bestNode, offset: clampedOffset },
    isCollapsed: true,
  };
}

/**
 * Gets all text nodes from the VDOM tree
 */
function getAllTextNodesWithPaths(vdom: VDOMNode[]): VDOMNode[] {
  const textNodes: VDOMNode[] = [];

  function traverse(nodes: VDOMNode[]): void {
    for (const node of nodes) {
      if (node.type === 'text') {
        textNodes.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(vdom);
  return textNodes;
}

/**
 * Calculates the "distance" between two paths for proximity comparison
 * Lower values indicate closer proximity
 */
function calculatePathDistance(path1: number[], path2: number[]): number {
  let commonPrefixLength = 0;
  const minLength = Math.min(path1.length, path2.length);

  // Find common prefix
  for (let i = 0; i < minLength; i++) {
    if (path1[i] === path2[i]) {
      commonPrefixLength++;
    } else {
      break;
    }
  }

  // Distance is the sum of remaining path lengths after common prefix
  const remainingPath1 = path1.length - commonPrefixLength;
  const remainingPath2 = path2.length - commonPrefixLength;

  return remainingPath1 + remainingPath2;
}

/**
 * Creates a fallback selection when no text nodes are available
 */
function createFallbackSelection(): VDOMSelection {
  // Create a minimal text node for fallback
  const fallbackNode: VDOMNode = {
    type: 'text',
    path: [0],
    content: '',
  };

  return {
    start: { node: fallbackNode, offset: 0 },
    end: { node: fallbackNode, offset: 0 },
    isCollapsed: true,
  };
}

/**
 * Enhanced deleteContent that includes cleanup operations
 * This version handles empty container removal and node merging
 */
export function deleteContentWithCleanup(
  vdom: VDOMNode[],
  selection: VDOMSelection,
): MutationResult {
  // Track the original selection path and offset for repositioning after cleanup
  const originalPath = [...selection.start.node.path];
  const originalOffset = selection.start.offset;

  // First, perform the basic deletion
  const basicResult = deleteContent(vdom, selection);

  // Then apply cleanup operations
  let cleanedVDOM = removeEmptyFormattingContainers(basicResult.newVDOM);
  cleanedVDOM = mergeAdjacentTextNodes(cleanedVDOM);

  // Fix the selection if the referenced node no longer exists after cleanup
  let fixedSelection = basicResult.newSelection;
  const referencedNode = findNodeByPath(cleanedVDOM, basicResult.newSelection.start.node.path);

  if (!referencedNode) {
    // The referenced node was removed during cleanup
    // Find the nearest valid text node by path proximity
    fixedSelection = findNearestValidPosition(cleanedVDOM, originalPath, originalOffset);
  }

  return {
    newVDOM: cleanedVDOM,
    newSelection: fixedSelection,
  };
}
