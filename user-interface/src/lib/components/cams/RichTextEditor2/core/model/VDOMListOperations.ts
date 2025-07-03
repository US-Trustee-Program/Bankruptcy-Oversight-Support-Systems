import { VDOMNode, VDOMSelection, ListType } from '../types';
import { createListNode, createListItemNode, createParagraphNode } from './VDOMNode';

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

// Removed findNodePath function as we no longer need it (no nodeId)

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
 * Checks if there is a list in the VDOM
 * Note: Since we no longer have nodeId, we need to use a different approach
 * This function now determines if there are any lists in the VDOM structure
 */
export function isInList(vdom: VDOMNode[], _selection: VDOMSelection): boolean {
  // Without nodeId, we need to analyze the VDOM structure to determine if there are lists

  // Traverse the VDOM to find any list nodes (ul/ol)
  function containsList(nodes: VDOMNode[]): boolean {
    for (const node of nodes) {
      if (node.type === 'ul' || node.type === 'ol') {
        return true;
      }

      if (node.children && node.children.length > 0 && containsList(node.children)) {
        return true;
      }
    }
    return false;
  }

  return containsList(vdom);
}

/**
 * Gets the list ancestor of a node
 *
 * Note: This function has been modified to work without nodeId
 * It now returns the first list found in the VDOM, which is a simplification
 * for the current implementation.
 */
export function getListAncestor(vdom: VDOMNode[]): VDOMNode | null {
  // Without nodeId, we need to scan the VDOM for the first list

  function findFirstList(nodes: VDOMNode[]): VDOMNode | null {
    for (const node of nodes) {
      if (node.type === 'ul' || node.type === 'ol') {
        return node;
      }

      if (node.children) {
        const listInChildren = findFirstList(node.children);
        if (listInChildren) {
          return listInChildren;
        }
      }
    }
    return null;
  }

  return findFirstList(vdom);
}

/**
 * Checks if a list toggle operation can be performed
 *
 * Since we no longer have nodeId, we'll allow toggling as long as we have content
 */
export function canToggleList(vdom: VDOMNode[], _selection: VDOMSelection): boolean {
  // Without nodeId, we'll just check if there's content in the VDOM
  return vdom.length > 0;
}

/**
 * Gets all nodes that are affected by the selection
 *
 * Note: Since we no longer have nodeId, we'll use a simpler approach that
 * just returns all top-level block nodes in the VDOM.
 */
function getAffectedNodes(vdom: VDOMNode[], _selection: VDOMSelection): VDOMNode[] {
  const affectedNodes: VDOMNode[] = [];

  // Without nodeId, we'll collect all top-level block nodes
  for (const node of vdom) {
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
