import { VDOMNode, VDOMSelection, VDOMPosition } from '../types';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';
import { createTextNode } from './VDOMNode';
import { textContentOffsetToNodeOffset } from './VDOMSelection';

/**
 * Result type for mutation operations
 */
export interface MutationResult {
  newVDOM: VDOMNode[];
  newSelection: VDOMSelection;
}

/**
 * Recursively finds a node by its ID in the VDOM tree
 */
export function findNodeById(vdom: VDOMNode[], nodeId: string): VDOMNode | null {
  for (const node of vdom) {
    if (node.id === nodeId) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, nodeId);
      if (found) {
        return found;
      }
    }
  }
  return null;
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
    id: node.id,
    type: node.type,
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
 * Finds the parent node and index of a child node
 */
function findParentAndIndex(
  vdom: VDOMNode[],
  targetId: string,
): { parent: VDOMNode | null; index: number } | null {
  for (const node of vdom) {
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        if (node.children[i].id === targetId) {
          return { parent: node, index: i };
        }
        const result = findParentAndIndex(node.children, targetId);
        if (result) {
          return result;
        }
      }
    }
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
  const targetNode = findNodeById(newVDOM, selection.start.nodeId);

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
    start: { nodeId: targetNode.id, offset: newOffset },
    end: { nodeId: targetNode.id, offset: newOffset },
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
    const targetNode = findNodeById(newVDOM, selection.start.nodeId);
    if (!targetNode || targetNode.type !== 'text' || selection.start.offset === 0) {
      return { newVDOM, newSelection: selection };
    }

    const currentContent = targetNode.content || '';
    const newOffset = Math.max(0, selection.start.offset - 1);
    const beforeText = currentContent.substring(0, newOffset);
    const afterText = currentContent.substring(selection.start.offset);

    targetNode.content = beforeText + afterText;

    const newSelection: VDOMSelection = {
      start: { nodeId: targetNode.id, offset: newOffset },
      end: { nodeId: targetNode.id, offset: newOffset },
      isCollapsed: true,
    };

    return { newVDOM, newSelection };
  }

  // Handle range deletion
  const targetNode = findNodeById(newVDOM, selection.start.nodeId);
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
    start: { nodeId: targetNode.id, offset: startOffset },
    end: { nodeId: targetNode.id, offset: startOffset },
    isCollapsed: true,
  };

  return { newVDOM, newSelection };
}

/**
 * Splits a text node at the specified position
 */
export function splitNode(vdom: VDOMNode[], position: VDOMPosition): MutationResult {
  const newVDOM = cloneVDOM(vdom);
  const targetNode = findNodeById(newVDOM, position.nodeId);

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

  const parentInfo = findParentAndIndex(newVDOM, position.nodeId);
  if (!parentInfo || !parentInfo.parent || !parentInfo.parent.children) {
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

  // Replace the original node with the two new nodes
  const children = parentInfo.parent.children;
  children.splice(parentInfo.index, 1, firstNode, secondNode);

  // Set selection to the beginning of the second node
  const newSelection: VDOMSelection = {
    start: { nodeId: secondNode.id, offset: 0 },
    end: { nodeId: secondNode.id, offset: 0 },
    isCollapsed: true,
  };

  return { newVDOM, newSelection };
}

/**
 * Merges two adjacent text nodes
 */
export function mergeNodes(
  vdom: VDOMNode[],
  firstNodeId: string,
  secondNodeId: string,
): MutationResult {
  const newVDOM = cloneVDOM(vdom);
  const firstNode = findNodeById(newVDOM, firstNodeId);
  const secondNode = findNodeById(newVDOM, secondNodeId);

  if (!firstNode || !secondNode || firstNode.type !== 'text' || secondNode.type !== 'text') {
    return {
      newVDOM,
      newSelection: {
        start: { nodeId: firstNodeId, offset: 0 },
        end: { nodeId: firstNodeId, offset: 0 },
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
  const secondParentInfo = findParentAndIndex(newVDOM, secondNodeId);
  if (secondParentInfo && secondParentInfo.parent && secondParentInfo.parent.children) {
    secondParentInfo.parent.children.splice(secondParentInfo.index, 1);
  }

  const newSelection: VDOMSelection = {
    start: { nodeId: firstNode.id, offset: mergeOffset },
    end: { nodeId: firstNode.id, offset: mergeOffset },
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
 * Enhanced deleteContent that includes cleanup operations
 * This version handles empty container removal and node merging
 */
export function deleteContentWithCleanup(
  vdom: VDOMNode[],
  selection: VDOMSelection,
): MutationResult {
  // Calculate the absolute offset of the selection start in the original VDOM
  // This helps us place the cursor correctly after cleanup
  const originalStartOffset = getAbsoluteOffsetFromOriginalVDOM(vdom, selection.start);

  // First, perform the basic deletion
  const basicResult = deleteContent(vdom, selection);

  // Then apply cleanup operations
  let cleanedVDOM = removeEmptyFormattingContainers(basicResult.newVDOM);
  cleanedVDOM = mergeAdjacentTextNodes(cleanedVDOM);

  // Fix the selection if the referenced node no longer exists after cleanup
  let fixedSelection = basicResult.newSelection;
  const startNodeId = basicResult.newSelection.start.nodeId;
  if (startNodeId) {
    const referencedNode = findNodeById(cleanedVDOM, startNodeId);

    if (!referencedNode) {
      // The referenced node was removed during cleanup
      // Use the original absolute offset to place cursor correctly
      fixedSelection = findPositionFromAbsoluteOffset(cleanedVDOM, originalStartOffset);
    }
  }

  return {
    newVDOM: cleanedVDOM,
    newSelection: fixedSelection,
  };
}

/**
 * Calculate absolute offset of a position in the original VDOM
 */
function getAbsoluteOffsetFromOriginalVDOM(vdom: VDOMNode[], position: VDOMPosition): number {
  if (!position.nodeId) {
    return position.offset || 0;
  }

  let absoluteOffset = 0;
  let found = false;

  function traverse(nodes: VDOMNode[]): void {
    if (found) return;

    for (const node of nodes) {
      if (found) return;

      if (node.id === position.nodeId) {
        absoluteOffset += position.offset || 0;
        found = true;
        return;
      }

      if (node.type === 'text' && node.content) {
        absoluteOffset += node.content.length;
      } else if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(vdom);
  return absoluteOffset;
}

/**
 * Find a position in the cleaned VDOM based on absolute offset
 * For BACKSPACE operations, we position at the deletion point
 */
function findPositionFromAbsoluteOffset(
  vdom: VDOMNode[],
  originalAbsoluteOffset: number,
): VDOMSelection {
  // For BACKSPACE, position the cursor at the deletion point
  // originalAbsoluteOffset is the position of the deleted character
  // We want the cursor positioned there (not -1)
  const targetOffset = originalAbsoluteOffset;

  const newPosition = textContentOffsetToNodeOffset(vdom, targetOffset);
  if (newPosition) {
    return {
      start: newPosition,
      end: newPosition,
      isCollapsed: true,
    };
  }

  // Fallback to end of last text node
  return findEndOfLastTextNode(vdom);
}

/**
 * Find the end position of the last text node (fallback)
 */
function findEndOfLastTextNode(vdom: VDOMNode[]): VDOMSelection {
  let lastTextNode: VDOMNode | null = null;

  function findLastTextNode(nodes: VDOMNode[]): void {
    for (const node of nodes) {
      if (node.type === 'text') {
        lastTextNode = node;
      } else if (node.children) {
        findLastTextNode(node.children);
      }
    }
  }

  findLastTextNode(vdom);

  if (lastTextNode) {
    const textNode = lastTextNode as VDOMNode & { type: 'text'; content?: string };
    const contentLength = textNode.content ? textNode.content.length : 0;
    return {
      start: { nodeId: textNode.id, offset: contentLength },
      end: { nodeId: textNode.id, offset: contentLength },
      isCollapsed: true,
    };
  }

  // Ultimate fallback
  if (vdom.length > 0) {
    return {
      start: { nodeId: vdom[0].id, offset: 0 },
      end: { nodeId: vdom[0].id, offset: 0 },
      isCollapsed: true,
    };
  }

  // Empty VDOM fallback
  return {
    start: { offset: 0 },
    end: { offset: 0 },
    isCollapsed: true,
  };
}
