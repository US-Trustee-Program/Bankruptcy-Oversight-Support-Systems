/**
 * Virtual DOM Tree management class for RichTextEditor2
 */

import { VNode, VNodeType, RootNode, isTextNode } from './VNode';
import { createRootNode } from './VNodeFactory';

export class VirtualDOMTree {
  private root: RootNode;

  /**
   * Create a new virtual DOM tree with a root node
   */
  constructor(customRoot?: RootNode) {
    this.root = customRoot || createRootNode();
  }

  /**
   * Get the root node of the tree
   */
  getRoot(): RootNode {
    return this.root;
  }

  /**
   * Find a node by its ID using depth-first search
   */
  findNodeById(id: string): VNode | null {
    let foundNode: VNode | null = null;

    this.traverseDepthFirst((node: VNode) => {
      if (node.id === id) {
        foundNode = node;
        return false; // Stop traversal
      }
      return true; // Continue traversal
    });

    return foundNode;
  }

  /**
   * Find all nodes of a specific type
   */
  findNodesByType(type: VNodeType): VNode[] {
    const nodes: VNode[] = [];

    this.traverseDepthFirst((node: VNode) => {
      if (node.type === type) {
        nodes.push(node);
      }
      return true; // Continue traversal
    });

    return nodes;
  }

  /**
   * Get the path from root to a specific node
   */
  getNodePath(targetNode: VNode): VNode[] {
    const path: VNode[] = [];
    let currentNode: VNode | null = targetNode;

    // Build path from target to root
    while (currentNode) {
      path.unshift(currentNode);
      currentNode = currentNode.parent;
    }

    return path;
  }

  /**
   * Get the next sibling of a node
   */
  getNextSibling(node: VNode): VNode | null {
    if (!node.parent) {
      return null; // Root node has no siblings
    }

    const siblings = node.parent.children;
    const currentIndex = siblings.indexOf(node);

    if (currentIndex === -1 || currentIndex === siblings.length - 1) {
      return null; // Node not found or is last sibling
    }

    return siblings[currentIndex + 1];
  }

  /**
   * Get the previous sibling of a node
   */
  getPreviousSibling(node: VNode): VNode | null {
    if (!node.parent) {
      return null; // Root node has no siblings
    }

    const siblings = node.parent.children;
    const currentIndex = siblings.indexOf(node);

    if (currentIndex <= 0) {
      return null; // Node not found or is first sibling
    }

    return siblings[currentIndex - 1];
  }

  /**
   * Traverse the tree in depth-first order
   * @param callback Function to call for each node. Return false to stop traversal.
   */
  traverseDepthFirst(callback: (node: VNode) => boolean | void): void {
    const traverse = (node: VNode): boolean => {
      const result = callback(node);

      // If callback returns false, stop traversal
      if (result === false) {
        return false;
      }

      // Continue with children
      for (const child of node.children) {
        if (traverse(child) === false) {
          return false;
        }
      }

      return true;
    };

    traverse(this.root);
  }

  /**
   * Get all text content from the tree or a specific node
   */
  getTextContent(startNode?: VNode): string {
    const textParts: string[] = [];
    const rootNode = startNode || this.root;

    const collectText = (node: VNode): void => {
      if (isTextNode(node)) {
        textParts.push(node.content);
      }

      for (const child of node.children) {
        collectText(child);
      }
    };

    collectText(rootNode);
    return textParts.join('');
  }

  /**
   * Validate the tree structure for consistency
   */
  validateTree(): boolean {
    let isValid = true;

    this.traverseDepthFirst((node: VNode) => {
      // Check parent-child relationships
      if (node.parent) {
        if (!node.parent.children.includes(node)) {
          isValid = false;
          return false; // Stop validation
        }

        // Check depth consistency
        if (node.depth !== node.parent.depth + 1) {
          isValid = false;
          return false; // Stop validation
        }
      } else {
        // Only root should have no parent
        if (node !== this.root) {
          isValid = false;
          return false; // Stop validation
        }
      }

      // Check children references
      for (const child of node.children) {
        if (child.parent !== node) {
          isValid = false;
          return false; // Stop validation
        }
      }

      return true; // Continue validation
    });

    return isValid;
  }

  /**
   * Create a deep copy of the tree
   */
  cloneTree(): VirtualDOMTree {
    const cloneNode = (node: VNode, newParent: VNode | null = null): VNode => {
      const clonedNode: VNode = {
        ...node,
        id: node.id, // Keep same ID for cloned nodes
        parent: newParent,
        children: [], // Will be filled recursively
      };

      // Clone children recursively
      for (const child of node.children) {
        const clonedChild = cloneNode(child, clonedNode);
        clonedNode.children.push(clonedChild);
      }

      return clonedNode;
    };

    const clonedRoot = cloneNode(this.root) as RootNode;
    return new VirtualDOMTree(clonedRoot);
  }

  /**
   * Get the range of nodes between two nodes (inclusive)
   */
  getNodeRange(startNode: VNode, endNode: VNode): VNode[] {
    const range: VNode[] = [];
    let capturing = false;

    this.traverseDepthFirst((node: VNode) => {
      if (node === startNode) {
        capturing = true;
      }

      if (capturing) {
        range.push(node);
      }

      if (node === endNode) {
        return false; // Stop traversal
      }

      return true; // Continue traversal
    });

    return range;
  }

  /**
   * Clone a single node without its children
   */
  cloneNode(node: VNode, deep: boolean = false): VNode {
    const clonedNode: VNode = {
      ...node,
      parent: null, // Cloned node starts with no parent
      children: deep ? [...node.children] : [], // Shallow or deep copy of children
    };

    return clonedNode;
  }
}
