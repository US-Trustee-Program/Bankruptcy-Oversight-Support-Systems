/**
 * Path-Based Selection Service
 * Implementation of DECISION-011: Path-Based Selection Addressing
 */

import { VNode } from '../virtual-dom/VNode';
import { Selection } from './EditorState';

/**
 * Service for managing path-based selection addressing
 * Converts between path-based selection and browser selection API
 */
export interface PathBasedSelectionService {
  /** Resolve path to a node in the virtual DOM */
  pathToNode(virtualDOM: VNode, path: number[]): VNode | null;
  /** Get path for a node in the virtual DOM */
  nodeToPath(virtualDOM: VNode, targetNode: VNode): number[] | null;
  /** Set browser selection based on path-based selection */
  setBrowserSelection(selection: Selection, realDOM: Element): void;
  /** Get current browser selection as path-based selection */
  getBrowserSelection(realDOM: Element, virtualDOM: VNode): Selection | null;
  /** Check if a path is valid for the given virtual DOM */
  isValidPath(virtualDOM: VNode, path: number[]): boolean;
  /** Get the deepest text node at the given path */
  getTextNodeAtPath(virtualDOM: VNode, path: number[]): VNode | null;
}

/**
 * Implementation of path-based selection service
 */
export class PathBasedSelectionServiceImpl implements PathBasedSelectionService {
  pathToNode(virtualDOM: VNode, path: number[]): VNode | null {
    if (path.length === 0) {
      return virtualDOM;
    }

    let currentNode = virtualDOM;

    for (const index of path) {
      if (!currentNode.children || index >= currentNode.children.length || index < 0) {
        return null;
      }
      currentNode = currentNode.children[index];
    }

    return currentNode;
  }

  nodeToPath(virtualDOM: VNode, targetNode: VNode): number[] | null {
    const path: number[] = [];

    if (targetNode === virtualDOM) {
      return [];
    }

    return this.findNodePath(virtualDOM, targetNode, path);
  }

  private findNodePath(
    currentNode: VNode,
    targetNode: VNode,
    currentPath: number[],
  ): number[] | null {
    if (currentNode === targetNode) {
      return [...currentPath];
    }

    if (!currentNode.children) {
      return null;
    }

    for (let i = 0; i < currentNode.children.length; i++) {
      const child = currentNode.children[i];
      const result = this.findNodePath(child, targetNode, [...currentPath, i]);
      if (result) {
        return result;
      }
    }

    return null;
  }

  setBrowserSelection(selection: Selection, realDOM: Element): void {
    const browserSelection = window.getSelection();
    if (!browserSelection) {
      return;
    }

    try {
      const startNode = this.findDOMNodeByPath(realDOM, selection.startPath);
      const endNode = this.findDOMNodeByPath(realDOM, selection.endPath);

      if (!startNode || !endNode) {
        return;
      }

      const range = document.createRange();

      // Set start position
      if (startNode.nodeType === Node.TEXT_NODE) {
        range.setStart(
          startNode,
          Math.min(selection.startOffset, startNode.textContent?.length || 0),
        );
      } else {
        range.setStart(startNode, 0);
      }

      // Set end position
      if (endNode.nodeType === Node.TEXT_NODE) {
        range.setEnd(endNode, Math.min(selection.endOffset, endNode.textContent?.length || 0));
      } else {
        range.setEnd(endNode, 0);
      }

      browserSelection.removeAllRanges();
      browserSelection.addRange(range);
    } catch (error) {
      // Gracefully handle invalid selections
      console.warn('Failed to set browser selection:', error);
    }
  }

  getBrowserSelection(realDOM: Element, _virtualDOM: VNode): Selection | null {
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.rangeCount === 0) {
      return null;
    }

    try {
      const range = browserSelection.getRangeAt(0);

      const startPath = this.findPathByDOMNode(realDOM, range.startContainer);
      const endPath = this.findPathByDOMNode(realDOM, range.endContainer);

      if (!startPath || !endPath) {
        return null;
      }

      return {
        startPath,
        startOffset: range.startOffset,
        endPath,
        endOffset: range.endOffset,
        isCollapsed: range.collapsed,
      };
    } catch (error) {
      console.warn('Failed to get browser selection:', error);
      return null;
    }
  }

  isValidPath(virtualDOM: VNode, path: number[]): boolean {
    return this.pathToNode(virtualDOM, path) !== null;
  }

  getTextNodeAtPath(virtualDOM: VNode, path: number[]): VNode | null {
    const node = this.pathToNode(virtualDOM, path);
    if (!node) {
      return null;
    }

    // If it's already a text node, return it
    if (node.type === 'text') {
      return node;
    }

    // Find the first text node child
    return this.findFirstTextNode(node);
  }

  private findFirstTextNode(node: VNode): VNode | null {
    if (node.type === 'text') {
      return node;
    }

    if (!node.children) {
      return null;
    }

    for (const child of node.children) {
      const textNode = this.findFirstTextNode(child);
      if (textNode) {
        return textNode;
      }
    }

    return null;
  }

  private findDOMNodeByPath(root: Element, path: number[]): Node | null {
    let currentNode: Node = root;

    for (const index of path) {
      if (index >= currentNode.childNodes.length || index < 0) {
        return null;
      }
      currentNode = currentNode.childNodes[index];
    }

    return currentNode;
  }

  private findPathByDOMNode(root: Element, targetNode: Node): number[] | null {
    const path: number[] = [];
    let current = targetNode;

    while (current && current !== root) {
      const parent = current.parentNode;
      if (!parent) {
        return null;
      }

      const index = Array.from(parent.childNodes).indexOf(current as ChildNode);
      if (index === -1) {
        return null;
      }

      path.unshift(index);
      current = parent;
    }

    return current === root ? path : null;
  }
}

/**
 * Helper functions for working with path-based selections
 */

/**
 * Create a collapsed selection (cursor) at the given path and offset
 */
export function createCollapsedSelection(path: number[], offset: number): Selection {
  return {
    startPath: [...path],
    startOffset: offset,
    endPath: [...path],
    endOffset: offset,
    isCollapsed: true,
  };
}

/**
 * Create a range selection between two positions
 */
export function createRangeSelection(
  startPath: number[],
  startOffset: number,
  endPath: number[],
  endOffset: number,
): Selection {
  return {
    startPath: [...startPath],
    startOffset,
    endPath: [...endPath],
    endOffset,
    isCollapsed: false,
  };
}

/**
 * Check if two selections are equal
 */
export function selectionsEqual(a: Selection, b: Selection): boolean {
  return (
    arraysEqual(a.startPath, b.startPath) &&
    a.startOffset === b.startOffset &&
    arraysEqual(a.endPath, b.endPath) &&
    a.endOffset === b.endOffset &&
    a.isCollapsed === b.isCollapsed
  );
}

/**
 * Check if two arrays are equal
 */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Clone a selection object
 */
export function cloneSelection(selection: Selection): Selection {
  return {
    startPath: [...selection.startPath],
    startOffset: selection.startOffset,
    endPath: [...selection.endPath],
    endOffset: selection.endOffset,
    isCollapsed: selection.isCollapsed,
  };
}
