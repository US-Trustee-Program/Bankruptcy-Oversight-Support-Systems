import { VDOMNode, VDOMSelection, VDOMNodeType, FORMAT_TO_VDOM_TYPE } from '../types';
import { RichTextFormat } from '../../RichTextEditor.constants';
import { createTextNode, createElementNode } from './VDOMNode';
import { findNodeById } from './VDOMMutations';

/**
 * Result type for formatting operations
 */
export interface FormattingResult {
  newVDOM: VDOMNode[];
  newSelection: VDOMSelection;
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
 * Checks if a node has a specific formatting ancestor
 */
function hasFormattingAncestor(
  vdom: VDOMNode[],
  nodeId: string,
  formatType: VDOMNodeType,
): boolean {
  function findNodePath(
    nodes: VDOMNode[],
    targetId: string,
    path: VDOMNode[] = [],
  ): VDOMNode[] | null {
    for (const node of nodes) {
      const currentPath = [...path, node];
      if (node.id === targetId) {
        return currentPath;
      }
      if (node.children) {
        const result = findNodePath(node.children, targetId, currentPath);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }

  const path = findNodePath(vdom, nodeId);
  if (!path) return false;

  return path.some((node) => node.type === formatType);
}

/**
 * Checks if formatting exists in the given selection range
 */
export function hasFormatInRange(
  vdom: VDOMNode[],
  selection: VDOMSelection,
  format: RichTextFormat,
): boolean {
  const formatType = FORMAT_TO_VDOM_TYPE[format];

  // For collapsed selection, check if cursor is within formatted text
  if (selection.isCollapsed) {
    return hasFormattingAncestor(vdom, selection.start.nodeId, formatType);
  }

  // For range selection, check if any part of the range has the formatting
  const startNode = findNodeById(vdom, selection.start.nodeId);
  const endNode = findNodeById(vdom, selection.end.nodeId);

  if (!startNode || !endNode) return false;

  // Simple case: same node
  if (selection.start.nodeId === selection.end.nodeId) {
    return hasFormattingAncestor(vdom, selection.start.nodeId, formatType);
  }

  // Complex case: multiple nodes - check all nodes in the range
  // This is a simplified implementation that checks if any node in the selection has the formatting
  function checkAllNodesInRange(nodes: VDOMNode[]): boolean {
    for (const node of nodes) {
      // Check if this node has the formatting
      if (hasFormattingAncestor(vdom, node.id, formatType)) {
        return true;
      }

      // Recursively check children
      if (node.children && checkAllNodesInRange(node.children)) {
        return true;
      }
    }
    return false;
  }

  // For multi-node selection, traverse the VDOM and check all text nodes
  // This is a simplified approach - in a full implementation we would need
  // to properly determine which nodes are actually in the selection range
  return checkAllNodesInRange(vdom);
}

/**
 * Splits a text node at the specified start and end offsets for formatting
 */
export function splitTextNodeForFormatting(
  vdom: VDOMNode[],
  nodeId: string,
  startOffset: number,
  endOffset: number,
): FormattingResult {
  const newVDOM = cloneVDOM(vdom);
  const targetNode = findNodeById(newVDOM, nodeId);

  if (!targetNode || targetNode.type !== 'text') {
    return {
      newVDOM,
      newSelection: {
        start: { nodeId, offset: startOffset },
        end: { nodeId, offset: endOffset },
        isCollapsed: startOffset === endOffset,
      },
    };
  }

  const parentInfo = findParentAndIndex(newVDOM, nodeId);
  if (!parentInfo || !parentInfo.parent || !parentInfo.parent.children) {
    return {
      newVDOM,
      newSelection: {
        start: { nodeId, offset: startOffset },
        end: { nodeId, offset: endOffset },
        isCollapsed: startOffset === endOffset,
      },
    };
  }

  const content = targetNode.content || '';
  const beforeText = content.substring(0, startOffset);
  const selectedText = content.substring(startOffset, endOffset);
  const afterText = content.substring(endOffset);

  const newNodes: VDOMNode[] = [];

  // Only create nodes for non-empty text
  if (beforeText) {
    newNodes.push(createTextNode(beforeText));
  }

  const selectedNode = createTextNode(selectedText);
  newNodes.push(selectedNode);

  if (afterText) {
    newNodes.push(createTextNode(afterText));
  }

  // Replace the original node with the new nodes
  const children = parentInfo.parent.children;
  children.splice(parentInfo.index, 1, ...newNodes);

  return {
    newVDOM,
    newSelection: {
      start: { nodeId: selectedNode.id, offset: 0 },
      end: { nodeId: selectedNode.id, offset: selectedText.length },
      isCollapsed: selectedText.length === 0,
    },
  };
}

/**
 * Applies formatting to a range by wrapping it in a formatting node
 */
export function applyFormatToRange(
  vdom: VDOMNode[],
  selection: VDOMSelection,
  format: RichTextFormat,
): FormattingResult {
  const formatType = FORMAT_TO_VDOM_TYPE[format];

  if (selection.isCollapsed) {
    return { newVDOM: vdom, newSelection: selection };
  }

  // Simple case: single text node
  if (selection.start.nodeId === selection.end.nodeId) {
    const splitResult = splitTextNodeForFormatting(
      vdom,
      selection.start.nodeId,
      selection.start.offset,
      selection.end.offset,
    );
    const newVDOM = splitResult.newVDOM;
    const selectedNode = findNodeById(newVDOM, splitResult.newSelection.start.nodeId);

    if (selectedNode && selectedNode.content) {
      const parentInfo = findParentAndIndex(newVDOM, selectedNode.id);
      if (parentInfo && parentInfo.parent && parentInfo.parent.children) {
        const formatNode = createElementNode(formatType, [selectedNode]);
        parentInfo.parent.children.splice(parentInfo.index, 1, formatNode);

        return {
          newVDOM,
          newSelection: {
            start: { nodeId: selectedNode.id, offset: 0 },
            end: { nodeId: selectedNode.id, offset: selectedNode.content.length },
            isCollapsed: false,
          },
        };
      }
    }
  }

  // For multi-node selections, this is a simplified implementation
  // In a full implementation, we would need to handle complex multi-node ranges
  return { newVDOM: vdom, newSelection: selection };
}

/**
 * Removes formatting from a range by unwrapping formatting nodes
 */
export function removeFormatFromRange(
  vdom: VDOMNode[],
  selection: VDOMSelection,
  format: RichTextFormat,
): FormattingResult {
  const formatType = FORMAT_TO_VDOM_TYPE[format];
  const newVDOM = cloneVDOM(vdom);

  if (selection.isCollapsed) {
    return { newVDOM, newSelection: selection };
  }

  // Find the node and check if it's within a formatting node
  const targetNode = findNodeById(newVDOM, selection.start.nodeId);
  if (!targetNode) {
    return { newVDOM, newSelection: selection };
  }

  // Find the formatting ancestor
  function findFormattingAncestor(
    nodes: VDOMNode[],
    targetId: string,
    path: VDOMNode[] = [],
  ): { formatNode: VDOMNode; parent: VDOMNode; index: number } | null {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const currentPath = [...path, node];

      if (node.id === targetId) {
        // Found target, now look for formatting ancestor in path
        for (let j = currentPath.length - 2; j >= 0; j--) {
          if (currentPath[j].type === formatType) {
            const formatNode = currentPath[j];
            const parent = j > 0 ? currentPath[j - 1] : null;
            if (parent && parent.children) {
              const index = parent.children.indexOf(formatNode);
              return { formatNode, parent, index };
            }
          }
        }
        return null;
      }

      if (node.children) {
        const result = findFormattingAncestor(node.children, targetId, currentPath);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }

  const ancestorInfo = findFormattingAncestor(newVDOM, selection.start.nodeId);
  if (ancestorInfo) {
    const { formatNode, parent, index } = ancestorInfo;

    // Replace the formatting node with its children
    if (formatNode.children && parent.children) {
      parent.children.splice(index, 1, ...formatNode.children);
    }
  }

  return {
    newVDOM,
    newSelection: selection,
  };
}

/**
 * Toggles formatting on the selected range
 */
export function toggleFormat(
  vdom: VDOMNode[],
  selection: VDOMSelection,
  format: RichTextFormat,
): FormattingResult {
  // For collapsed selection, don't modify VDOM
  if (selection.isCollapsed) {
    return { newVDOM: vdom, newSelection: selection };
  }

  // Check if the range already has this formatting
  const hasFormat = hasFormatInRange(vdom, selection, format);

  if (hasFormat) {
    // Remove formatting
    return removeFormatFromRange(vdom, selection, format);
  } else {
    // Apply formatting
    return applyFormatToRange(vdom, selection, format);
  }
}
