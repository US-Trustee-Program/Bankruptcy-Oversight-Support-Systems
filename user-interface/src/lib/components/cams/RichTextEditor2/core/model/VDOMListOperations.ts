import { VDOMNode, VDOMSelection, ListType } from '../types';
import { createListNode, createListItemNode, createParagraphNode } from './VDOMNode';
import { findNodeById } from './VDOMMutations';

/**
 * Result type for list operations
 */
export interface ListOperationResult {
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
 * Finds the path from root to a specific node
 */
function findNodePath(vdom: VDOMNode[], targetId: string): VDOMNode[] | null {
  function traverse(nodes: VDOMNode[], path: VDOMNode[]): VDOMNode[] | null {
    for (const node of nodes) {
      const currentPath = [...path, node];

      if (node.id === targetId) {
        return currentPath;
      }

      if (node.children) {
        const result = traverse(node.children, currentPath);
        if (result) return result;
      }
    }
    return null;
  }

  return traverse(vdom, []);
}

/**
 * Converts a paragraph node to a list item node
 */
export function convertParagraphToListItem(paragraph: VDOMNode): VDOMNode {
  const listItem = createListItemNode();

  // Copy children from paragraph to list item
  if (paragraph.children) {
    listItem.children = paragraph.children.map(cloneNode);
  }

  return listItem;
}

/**
 * Converts a list item node to a paragraph node
 */
export function convertListItemToParagraph(listItem: VDOMNode): VDOMNode {
  const paragraph = createParagraphNode();

  // Copy children from list item to paragraph
  if (listItem.children) {
    paragraph.children = listItem.children.map(cloneNode);
  }

  return paragraph;
}

/**
 * Checks if a selection is within a list
 */
export function isInList(vdom: VDOMNode[], selection: VDOMSelection): boolean {
  const path = findNodePath(vdom, selection.start.nodeId);
  if (!path) return false;

  return path.some((node) => node.type === 'ul' || node.type === 'ol');
}

/**
 * Gets the list ancestor of a node
 */
export function getListAncestor(vdom: VDOMNode[], nodeId: string): VDOMNode | null {
  const path = findNodePath(vdom, nodeId);
  if (!path) return null;

  // Find the first list node in the path
  for (const node of path) {
    if (node.type === 'ul' || node.type === 'ol') {
      return node;
    }
  }

  return null;
}

/**
 * Checks if a list toggle operation can be performed
 */
export function canToggleList(vdom: VDOMNode[], selection: VDOMSelection): boolean {
  // Can always toggle if we have a valid selection
  const startNode = findNodeById(vdom, selection.start.nodeId);
  return startNode !== null;
}

/**
 * Gets all nodes that are affected by the selection
 */
function getAffectedNodes(vdom: VDOMNode[], selection: VDOMSelection): VDOMNode[] {
  const affectedNodes: VDOMNode[] = [];

  // For collapsed selection, just get the containing block
  if (selection.isCollapsed) {
    const path = findNodePath(vdom, selection.start.nodeId);
    if (path) {
      // Find the top-level block (paragraph or list)
      for (const node of path) {
        if (node.type === 'paragraph' || node.type === 'ul' || node.type === 'ol') {
          affectedNodes.push(node);
          break;
        }
      }
    }
    return affectedNodes;
  }

  // For range selection, find all top-level nodes that contain the selection
  const startPath = findNodePath(vdom, selection.start.nodeId);
  const endPath = findNodePath(vdom, selection.end.nodeId);

  if (!startPath || !endPath) {
    return affectedNodes;
  }

  // Find the top-level nodes for start and end
  let startTopLevel: VDOMNode | null = null;
  let endTopLevel: VDOMNode | null = null;

  for (const node of startPath) {
    if (vdom.includes(node)) {
      startTopLevel = node;
      break;
    }
  }

  for (const node of endPath) {
    if (vdom.includes(node)) {
      endTopLevel = node;
      break;
    }
  }

  if (!startTopLevel || !endTopLevel) {
    return affectedNodes;
  }

  // Find all nodes between start and end (inclusive)
  const startIndex = vdom.indexOf(startTopLevel);
  const endIndex = vdom.indexOf(endTopLevel);

  for (let i = startIndex; i <= endIndex; i++) {
    const node = vdom[i];
    if (node.type === 'paragraph' || node.type === 'ul' || node.type === 'ol') {
      affectedNodes.push(node);
    }
  }

  return affectedNodes;
}

/**
 * Toggles list formatting for the selected content
 */
export function toggleList(
  vdom: VDOMNode[],
  selection: VDOMSelection,
  listType: ListType,
): ListOperationResult {
  const newVDOM = cloneVDOM(vdom);
  const newSelection = { ...selection };

  const affectedNodes = getAffectedNodes(newVDOM, selection);

  if (affectedNodes.length === 0) {
    return { newVDOM, newSelection };
  }

  // Check the composition of affected nodes
  const listNodes = affectedNodes.filter((node) => node.type === 'ul' || node.type === 'ol');
  const sameTypeListNodes = affectedNodes.filter((node) => node.type === listType);

  // If all affected nodes are lists of the same type, convert back to paragraphs
  if (affectedNodes.length > 0 && sameTypeListNodes.length === affectedNodes.length) {
    return convertListToParagraphs(newVDOM, affectedNodes, newSelection);
  }

  // If all affected nodes are lists of a different type, convert to new list type
  if (
    affectedNodes.length > 0 &&
    listNodes.length === affectedNodes.length &&
    sameTypeListNodes.length === 0
  ) {
    return convertListType(newVDOM, affectedNodes, listType, newSelection);
  }

  // For mixed content or paragraphs, convert everything to the target list type
  return convertParagraphsToList(newVDOM, affectedNodes, listType, newSelection);
}

/**
 * Converts paragraphs and lists to a single list
 */
function convertParagraphsToList(
  vdom: VDOMNode[],
  affectedNodes: VDOMNode[],
  listType: ListType,
  selection: VDOMSelection,
): ListOperationResult {
  const newVDOM = [...vdom];
  const newSelection = { ...selection };

  // Find the first affected node's index in the VDOM
  const firstNodeIndex = newVDOM.findIndex((node) => affectedNodes.includes(node));

  if (firstNodeIndex === -1) {
    return { newVDOM, newSelection };
  }

  // Convert all affected nodes to list items
  const listItems: VDOMNode[] = [];
  const indicesToRemove: number[] = [];

  for (let i = 0; i < newVDOM.length; i++) {
    const node = newVDOM[i];
    if (affectedNodes.includes(node)) {
      if (node.type === 'paragraph') {
        listItems.push(convertParagraphToListItem(node));
      } else if (node.type === 'ul' || node.type === 'ol') {
        // Extract list items from existing lists
        if (node.children) {
          for (const child of node.children) {
            if (child.type === 'li') {
              listItems.push(cloneNode(child));
            }
          }
        }
      }
      indicesToRemove.push(i);
    }
  }

  // Remove affected nodes in reverse order to maintain indices
  for (let i = indicesToRemove.length - 1; i >= 0; i--) {
    newVDOM.splice(indicesToRemove[i], 1);
  }

  // Create the new list and insert it
  const list = createListNode(listItems, listType);
  newVDOM.splice(firstNodeIndex, 0, list);

  return { newVDOM, newSelection };
}

/**
 * Converts a list back to paragraphs
 */
function convertListToParagraphs(
  vdom: VDOMNode[],
  lists: VDOMNode[],
  selection: VDOMSelection,
): ListOperationResult {
  const newVDOM = [...vdom];
  const newSelection = { ...selection };

  for (let i = newVDOM.length - 1; i >= 0; i--) {
    const node = newVDOM[i];
    if (lists.includes(node) && (node.type === 'ul' || node.type === 'ol')) {
      // Convert list items to paragraphs
      const paragraphs: VDOMNode[] = [];
      if (node.children) {
        for (const listItem of node.children) {
          if (listItem.type === 'li') {
            paragraphs.push(convertListItemToParagraph(listItem));
          }
        }
      }

      // Replace the list with paragraphs
      newVDOM.splice(i, 1, ...paragraphs);
    }
  }

  return { newVDOM, newSelection };
}

/**
 * Converts a list to a different list type
 */
function convertListType(
  vdom: VDOMNode[],
  lists: VDOMNode[],
  newListType: ListType,
  selection: VDOMSelection,
): ListOperationResult {
  const newVDOM = [...vdom];
  const newSelection = { ...selection };

  for (const node of newVDOM) {
    if (lists.includes(node) && (node.type === 'ul' || node.type === 'ol')) {
      // Change the list type
      node.type = newListType;
    }
  }

  return { newVDOM, newSelection };
}
