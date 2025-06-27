/**
 * FormattingRemover utility for removing formatting from virtual DOM nodes
 */

import { VNode, isFormattingNode, FormattingNode } from './virtual-dom/VNode';
import { FormattingType } from './formatting-analysis.types';
import { FormattingDetector } from './FormattingDetector';
import { createFormattingNode } from './virtual-dom/VNodeFactory';

/**
 * Utility class for removing formatting from virtual DOM nodes
 */
export class FormattingRemover {
  /**
   * Unwrap a formatting node, promoting its children to the parent
   */
  unwrapFormattingNode(formattingNode: FormattingNode): VNode[] {
    const parent = formattingNode.parent;
    const children = [...formattingNode.children]; // Create a copy to avoid mutation during iteration

    if (parent) {
      // Find the index of the formatting node in its parent's children
      const nodeIndex = parent.children.indexOf(formattingNode);

      // Remove the formatting node from its parent
      parent.children.splice(nodeIndex, 1);

      // Insert the children at the same position
      if (children.length > 0) {
        parent.children.splice(nodeIndex, 0, ...children);

        // Update parent references for the promoted children
        children.forEach((child) => {
          child.parent = parent;
        });
      }
    }

    // Clear the formatting node's relationships
    formattingNode.parent = null;
    formattingNode.children = [];

    return children;
  }

  /**
   * Remove specific formatting from a node
   */
  removeFormatting(node: VNode, formatType: FormattingType): VNode[] {
    // If this is a formatting node of the target type, unwrap it
    if (isFormattingNode(node) && node.formatType === formatType) {
      return this.unwrapFormattingNode(node);
    }

    // If this node has the formatting through an ancestor, find and unwrap the ancestor
    if (FormattingDetector.isDescendantOfFormatting(node, formatType)) {
      return this.removeFormattingFromAncestors(node, formatType);
    }

    // No formatting to remove, return the node as-is
    return [node];
  }

  /**
   * Remove formatting from a selection of nodes
   */
  removeFormattingFromSelection(selectedNodes: VNode[], formatType: FormattingType): VNode[] {
    const resultNodes: VNode[] = [];

    for (const node of selectedNodes) {
      const processedNodes = this.removeFormatting(node, formatType);
      resultNodes.push(...processedNodes);
    }

    return resultNodes;
  }

  /**
   * Remove formatting from ancestors of a node
   */
  private removeFormattingFromAncestors(node: VNode, formatType: FormattingType): VNode[] {
    let currentNode = node.parent;

    // Find the formatting ancestor
    while (currentNode !== null) {
      if (isFormattingNode(currentNode) && currentNode.formatType === formatType) {
        // Found the formatting ancestor to remove
        this.unwrapFormattingNode(currentNode);
        // Return the original node that was requested
        return [node];
      }
      currentNode = currentNode.parent;
    }

    // No formatting ancestor found, return the node as-is
    return [node];
  }

  /**
   * Split a formatting node at selection boundaries
   * This is useful when removing formatting from only part of a formatted node's content
   * 
   * For example, if we have: "This is <strong>another</strong> test"
   * And the selection is: "another test"
   * We want to split the strong node to get: "This is <strong>another test</strong>"
   */
  splitFormattingNodeAtBoundaries(
    formattingNode: FormattingNode,
    selectedNodes: VNode[],
  ): VNode[] {
    const selectedNodeSet = new Set(selectedNodes);
    const allChildren = formattingNode.children;
    const parent = formattingNode.parent;

    if (!parent) {
      return [formattingNode]; // Can't split if no parent
    }

    // Check if all children are selected
    const allChildrenSelected = allChildren.every((child) => selectedNodeSet.has(child));

    if (allChildrenSelected) {
      // If all children are selected, just unwrap the formatting node
      return this.unwrapFormattingNode(formattingNode);
    }

    // Find which children are selected and which are not
    const selectedChildren: VNode[] = [];
    const unselectedChildren: VNode[] = [];

    allChildren.forEach((child) => {
      if (selectedNodeSet.has(child)) {
        selectedChildren.push(child);
      } else {
        unselectedChildren.push(child);
      }
    });

    if (selectedChildren.length === 0) {
      // No children are selected, return the node unchanged
      return [formattingNode];
    }

    // Find the index of the formatting node in its parent's children
    const nodeIndex = parent.children.indexOf(formattingNode);
    if (nodeIndex === -1) {
      return [formattingNode]; // Node not found in parent's children
    }

    // Remove the formatting node from its parent
    parent.children.splice(nodeIndex, 1);

    // Create new formatting nodes for the unselected parts
    const resultNodes: VNode[] = [];

    // Group consecutive unselected children
    const unselectedGroups: VNode[][] = [];
    let currentGroup: VNode[] = [];

    // Find the position of the first selected child
    const firstSelectedIndex = allChildren.findIndex((child) => selectedNodeSet.has(child));

    // Find the position of the last selected child
    const lastSelectedIndex = allChildren.findIndex((child, index) => 
      selectedNodeSet.has(child) && 
      (index === allChildren.length - 1 || !selectedNodeSet.has(allChildren[index + 1]))
    );

    // If there are unselected children before the selection, create a formatting node for them
    if (firstSelectedIndex > 0) {
      const beforeGroup = allChildren.slice(0, firstSelectedIndex);
      const beforeFormatNode = createFormattingNode(formattingNode.formatType);

      // Add the formatting node to the parent
      parent.children.splice(nodeIndex, 0, beforeFormatNode);
      beforeFormatNode.parent = parent;

      // Add the unselected children to the formatting node
      beforeGroup.forEach((child, index) => {
        beforeFormatNode.children.push(child);
        child.parent = beforeFormatNode;
      });

      resultNodes.push(beforeFormatNode);
    }

    // Add the selected children directly to the parent
    selectedChildren.forEach((child) => {
      parent.children.splice(nodeIndex + resultNodes.length, 0, child);
      child.parent = parent;
      resultNodes.push(child);
    });

    // If there are unselected children after the selection, create a formatting node for them
    if (lastSelectedIndex < allChildren.length - 1) {
      const afterGroup = allChildren.slice(lastSelectedIndex + 1);
      const afterFormatNode = createFormattingNode(formattingNode.formatType);

      // Add the formatting node to the parent
      parent.children.splice(nodeIndex + resultNodes.length, 0, afterFormatNode);
      afterFormatNode.parent = parent;

      // Add the unselected children to the formatting node
      afterGroup.forEach((child) => {
        afterFormatNode.children.push(child);
        child.parent = afterFormatNode;
      });

      resultNodes.push(afterFormatNode);
    }

    // Clear the original formatting node's relationships
    formattingNode.parent = null;
    formattingNode.children = [];

    return resultNodes;
  }

  /**
   * Split a formatting node around a selection (for partial formatting removal)
   * This is useful when removing formatting from only part of a formatted node's content
   * @deprecated Use splitFormattingNodeAtBoundaries instead
   */
  splitFormattingNodeAroundSelection(
    formattingNode: FormattingNode,
    selectedNodes: VNode[],
  ): VNode[] {
    return this.splitFormattingNodeAtBoundaries(formattingNode, selectedNodes);
  }
}
