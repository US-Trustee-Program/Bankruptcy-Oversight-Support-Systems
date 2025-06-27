/**
 * FormattingRemover utility for removing formatting from virtual DOM nodes
 */

import { VNode, isFormattingNode, FormattingNode } from './virtual-dom/VNode';
import { FormattingType } from './formatting-analysis.types';
import { FormattingDetector } from './FormattingDetector';

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
   * Split a formatting node around a selection (for partial formatting removal)
   * This is useful when removing formatting from only part of a formatted node's content
   */
  splitFormattingNodeAroundSelection(
    formattingNode: FormattingNode,
    selectedNodes: VNode[],
  ): VNode[] {
    // This is a more complex operation for partial selections
    // For now, we'll implement the simpler case of removing the entire formatting
    const selectedNodeSet = new Set(selectedNodes);
    const allChildren = formattingNode.children;

    // Check if all children are selected
    const allChildrenSelected = allChildren.every((child) => selectedNodeSet.has(child));

    if (allChildrenSelected) {
      // Remove the entire formatting node
      return this.unwrapFormattingNode(formattingNode);
    } else {
      // For partial selection, we need more complex logic
      // This would involve creating new formatting nodes for unselected parts
      // For now, return the node unchanged to maintain structure
      return [formattingNode];
    }
  }
}
