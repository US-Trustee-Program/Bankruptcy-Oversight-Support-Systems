import { describe, test, expect, beforeEach } from 'vitest';
import { VNodeType, VNode } from './VNode';
import {
  createTextNode,
  createElementNode,
  createRootNode,
  resetNodeIdCounter,
} from './VNodeFactory';
import { VirtualDOMTree } from './VirtualDOMTree';

describe('VirtualDOMTree', () => {
  let tree: VirtualDOMTree;

  beforeEach(() => {
    resetNodeIdCounter();
    tree = new VirtualDOMTree();
  });

  describe('constructor', () => {
    test('should create a tree with a root node', () => {
      expect(tree.getRoot()).toBeDefined();
      expect(tree.getRoot().type).toBe(VNodeType.ROOT);
      expect(tree.getRoot().parent).toBeNull();
      expect(tree.getRoot().children).toEqual([]);
      expect(tree.getRoot().depth).toBe(0);
    });

    test('should create tree with custom root node', () => {
      const customRoot = createRootNode({ endOffset: 100 });
      const customTree = new VirtualDOMTree(customRoot);

      expect(customTree.getRoot()).toBe(customRoot);
      expect(customTree.getRoot().endOffset).toBe(100);
    });
  });

  describe('findNodeById', () => {
    test('should find root node by ID', () => {
      const root = tree.getRoot();
      const foundNode = tree.findNodeById(root.id);

      expect(foundNode).toBe(root);
    });

    test('should find child node by ID', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p', { parent: root, depth: 1 });
      root.children.push(paragraph);

      const foundNode = tree.findNodeById(paragraph.id);
      expect(foundNode).toBe(paragraph);
    });

    test('should find deeply nested node by ID', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p', { parent: root, depth: 1 });
      const textNode = createTextNode('Hello', { parent: paragraph, depth: 2 });

      root.children.push(paragraph);
      paragraph.children.push(textNode);

      const foundNode = tree.findNodeById(textNode.id);
      expect(foundNode).toBe(textNode);
    });

    test('should return null for non-existent ID', () => {
      const foundNode = tree.findNodeById('non-existent-id');
      expect(foundNode).toBeNull();
    });
  });

  describe('findNodesByType', () => {
    beforeEach(() => {
      // Create a sample tree structure
      const root = tree.getRoot();
      const paragraph1 = createElementNode('p', { parent: root, depth: 1 });
      const paragraph2 = createElementNode('p', { parent: root, depth: 1 });
      const text1 = createTextNode('Hello', { parent: paragraph1, depth: 2 });
      const text2 = createTextNode('World', { parent: paragraph2, depth: 2 });

      root.children.push(paragraph1, paragraph2);
      paragraph1.children.push(text1);
      paragraph2.children.push(text2);
    });

    test('should find all text nodes', () => {
      const textNodes = tree.findNodesByType(VNodeType.TEXT);

      expect(textNodes).toHaveLength(2);
      expect(textNodes.every((node) => node.type === VNodeType.TEXT)).toBe(true);
    });

    test('should find all element nodes', () => {
      const elementNodes = tree.findNodesByType(VNodeType.ELEMENT);

      expect(elementNodes).toHaveLength(2);
      expect(elementNodes.every((node) => node.type === VNodeType.ELEMENT)).toBe(true);
    });

    test('should find root node', () => {
      const rootNodes = tree.findNodesByType(VNodeType.ROOT);

      expect(rootNodes).toHaveLength(1);
      expect(rootNodes[0]).toBe(tree.getRoot());
    });

    test('should return empty array for non-existent type', () => {
      const formattingNodes = tree.findNodesByType(VNodeType.FORMATTING);
      expect(formattingNodes).toEqual([]);
    });
  });

  describe('getNodePath', () => {
    test('should return path from root to target node', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p', { parent: root, depth: 1 });
      const textNode = createTextNode('Hello', { parent: paragraph, depth: 2 });

      root.children.push(paragraph);
      paragraph.children.push(textNode);

      const path = tree.getNodePath(textNode);
      expect(path).toEqual([root, paragraph, textNode]);
    });

    test('should return single node path for root', () => {
      const root = tree.getRoot();
      const path = tree.getNodePath(root);

      expect(path).toEqual([root]);
    });

    test('should return correct path for direct child of root', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p', { parent: root, depth: 1 });
      root.children.push(paragraph);

      const path = tree.getNodePath(paragraph);
      expect(path).toEqual([root, paragraph]);
    });
  });

  describe('getNextSibling', () => {
    test('should return next sibling node', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const para3 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1, para2, para3);

      expect(tree.getNextSibling(para1)).toBe(para2);
      expect(tree.getNextSibling(para2)).toBe(para3);
    });

    test('should return null for last sibling', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1, para2);

      expect(tree.getNextSibling(para2)).toBeNull();
    });

    test('should return null for only child', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para);

      expect(tree.getNextSibling(para)).toBeNull();
    });

    test('should return null for root node', () => {
      const root = tree.getRoot();
      expect(tree.getNextSibling(root)).toBeNull();
    });
  });

  describe('getPreviousSibling', () => {
    test('should return previous sibling node', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const para3 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1, para2, para3);

      expect(tree.getPreviousSibling(para2)).toBe(para1);
      expect(tree.getPreviousSibling(para3)).toBe(para2);
    });

    test('should return null for first sibling', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1, para2);

      expect(tree.getPreviousSibling(para1)).toBeNull();
    });

    test('should return null for root node', () => {
      const root = tree.getRoot();
      expect(tree.getPreviousSibling(root)).toBeNull();
    });
  });

  describe('traverseDepthFirst', () => {
    test('should visit all nodes in depth-first order', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const text1 = createTextNode('Hello', { parent: para1, depth: 2 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const text2 = createTextNode('World', { parent: para2, depth: 2 });

      root.children.push(para1, para2);
      para1.children.push(text1);
      para2.children.push(text2);

      const visitedNodes: VNode[] = [];
      tree.traverseDepthFirst((node: VNode) => {
        visitedNodes.push(node);
      });

      expect(visitedNodes).toEqual([root, para1, text1, para2, text2]);
    });

    test('should allow early termination when callback returns false', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const text1 = createTextNode('Hello', { parent: para1, depth: 2 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1, para2);
      para1.children.push(text1);

      const visitedNodes: VNode[] = [];
      tree.traverseDepthFirst((node: VNode) => {
        visitedNodes.push(node);
        return node !== text1; // Stop after visiting text1
      });

      expect(visitedNodes).toEqual([root, para1, text1]);
    });
  });

  describe('getTextContent', () => {
    test('should extract all text content from the tree', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const text1 = createTextNode('Hello ', { parent: para1, depth: 2 });
      const text2 = createTextNode('World', { parent: para1, depth: 2 });

      root.children.push(para1);
      para1.children.push(text1, text2);

      const textContent = tree.getTextContent();
      expect(textContent).toBe('Hello World');
    });

    test('should return empty string for tree with no text nodes', () => {
      const textContent = tree.getTextContent();
      expect(textContent).toBe('');
    });

    test('should extract text content from specific node and its children', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const text1 = createTextNode('Hello', { parent: para1, depth: 2 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const text2 = createTextNode('World', { parent: para2, depth: 2 });

      root.children.push(para1, para2);
      para1.children.push(text1);
      para2.children.push(text2);

      const textContent = tree.getTextContent(para1);
      expect(textContent).toBe('Hello');
    });
  });

  describe('validateTree', () => {
    test('should validate a correct tree structure', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: para, depth: 2 });

      root.children.push(para);
      para.children.push(text);

      const isValid = tree.validateTree();
      expect(isValid).toBe(true);
    });

    test('should detect incorrect parent relationships', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: null, depth: 1 }); // Incorrect parent

      root.children.push(para);

      const isValid = tree.validateTree();
      expect(isValid).toBe(false);
    });

    test('should detect incorrect depth values', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 5 }); // Incorrect depth

      root.children.push(para);

      const isValid = tree.validateTree();
      expect(isValid).toBe(false);
    });
  });

  describe('cloneTree', () => {
    test('should create a deep copy of the tree', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: para, depth: 2 });

      root.children.push(para);
      para.children.push(text);

      const clonedTree = tree.cloneTree();

      expect(clonedTree).not.toBe(tree);
      expect(clonedTree.getRoot()).not.toBe(root);
      expect(clonedTree.getRoot().type).toBe(VNodeType.ROOT);
      expect(clonedTree.getTextContent()).toBe('Hello');
    });

    test('should create independent copy that can be modified separately', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      root.children.push(para);

      const clonedTree = tree.cloneTree();
      const newText = createTextNode('New text', { parent: clonedTree.getRoot(), depth: 1 });
      clonedTree.getRoot().children.push(newText);

      expect(tree.getTextContent()).toBe('');
      expect(clonedTree.getTextContent()).toBe('New text');
    });
  });

  describe('getNodeRange', () => {
    test('should return range of nodes between start and end nodes', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const text1 = createTextNode('Hello', { parent: para1, depth: 2 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const text2 = createTextNode('World', { parent: para2, depth: 2 });
      const para3 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1, para2, para3);
      para1.children.push(text1);
      para2.children.push(text2);

      const range = tree.getNodeRange(para1, para2);
      expect(range).toEqual([para1, text1, para2, text2]);
    });

    test('should return single node when start and end are the same', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      root.children.push(para);

      const range = tree.getNodeRange(para, para);
      expect(range).toEqual([para]);
    });

    test('should return range starting from root', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: para, depth: 2 });

      root.children.push(para);
      para.children.push(text);

      const range = tree.getNodeRange(root, text);
      expect(range).toEqual([root, para, text]);
    });

    test('should return empty range when start node is not found before end node', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1, para2);

      // Start with para2, end with para1 (reverse order)
      const range = tree.getNodeRange(para2, para1);
      expect(range).toEqual([]);
    });

    test('should handle deeply nested nodes', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const span1 = createElementNode('span', { parent: para, depth: 2 });
      const text1 = createTextNode('Hello', { parent: span1, depth: 3 });
      const span2 = createElementNode('span', { parent: para, depth: 2 });
      const text2 = createTextNode('World', { parent: span2, depth: 3 });

      root.children.push(para);
      para.children.push(span1, span2);
      span1.children.push(text1);
      span2.children.push(text2);

      const range = tree.getNodeRange(span1, text2);
      expect(range).toEqual([span1, text1, span2, text2]);
    });
  });

  describe('cloneNode', () => {
    test('should clone node without children by default', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: para, depth: 2 });

      root.children.push(para);
      para.children.push(text);

      const clonedNode = tree.cloneNode(para);

      expect(clonedNode).not.toBe(para);
      expect(clonedNode.type).toBe(para.type);
      expect(clonedNode.tagName).toBe(para.tagName);
      expect(clonedNode.parent).toBeNull();
      expect(clonedNode.children).toEqual([]);
    });

    test('should clone node with shallow copy of children when deep=true', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: para, depth: 2 });

      root.children.push(para);
      para.children.push(text);

      const clonedNode = tree.cloneNode(para, true);

      expect(clonedNode).not.toBe(para);
      expect(clonedNode.children).toEqual([text]);
      expect(clonedNode.children[0]).toBe(text); // Same reference, shallow copy
      expect(clonedNode.parent).toBeNull();
    });

    test('should clone text node correctly', () => {
      const text = createTextNode('Hello World', { parent: tree.getRoot(), depth: 1 });

      const clonedText = tree.cloneNode(text);

      expect(clonedText).not.toBe(text);
      expect(clonedText.type).toBe(VNodeType.TEXT);
      expect(clonedText.content).toBe('Hello World');
      expect(clonedText.parent).toBeNull();
      expect(clonedText.children).toEqual([]);
    });

    test('should clone root node correctly', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      root.children.push(para);

      const clonedRoot = tree.cloneNode(root);

      expect(clonedRoot).not.toBe(root);
      expect(clonedRoot.type).toBe(VNodeType.ROOT);
      expect(clonedRoot.parent).toBeNull();
      expect(clonedRoot.children).toEqual([]);
    });

    test('should preserve node properties in clone', () => {
      const para = createElementNode('p', {
        parent: tree.getRoot(),
        depth: 1,
        startOffset: 10,
        endOffset: 20,
      });

      const clonedPara = tree.cloneNode(para);

      expect(clonedPara.id).toBe(para.id);
      expect(clonedPara.depth).toBe(para.depth);
      expect(clonedPara.startOffset).toBe(para.startOffset);
      expect(clonedPara.endOffset).toBe(para.endOffset);
      expect(clonedPara.parent).toBeNull();
    });
  });

  describe('edge cases and error conditions', () => {
    test('getNextSibling should return null when node not found in parent children', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1);
      // para2 is not in root.children but claims root as parent

      expect(tree.getNextSibling(para2)).toBeNull();
    });

    test('getPreviousSibling should return null when node not found in parent children', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1);
      // para2 is not in root.children but claims root as parent

      expect(tree.getPreviousSibling(para2)).toBeNull();
    });

    test('validateTree should detect child with wrong parent reference', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: null, depth: 2 }); // Wrong parent

      root.children.push(para);
      para.children.push(text);

      const isValid = tree.validateTree();
      expect(isValid).toBe(false);
    });

    test('validateTree should detect orphaned non-root node', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: null, depth: 1 }); // Orphaned non-root

      root.children.push(para);

      const isValid = tree.validateTree();
      expect(isValid).toBe(false);
    });

    test('validateTree should detect node not in parent children array', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: para, depth: 2 });

      // Set up the tree structure normally first
      root.children.push(para);
      para.children.push(text);

      // Now create inconsistent state by manually removing text from para.children
      // while keeping text.parent = para
      para.children.length = 0; // Clear para's children array

      // But text still thinks para is its parent, and text is still reachable
      // through the tree traversal because it's in para's children initially
      // We need to add text back to make it traversable but with wrong parent reference
      para.children.push(text);

      // Now manually set text.parent to something else while it's in para.children
      const otherPara = createElementNode('div', { parent: root, depth: 1 });
      text.parent = otherPara; // text.parent = otherPara but para.children includes text

      const isValid = tree.validateTree();
      expect(isValid).toBe(false);
    });

    test('validateTree should detect child with different parent reference', () => {
      const root = tree.getRoot();
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: para2, depth: 2 }); // text thinks para2 is parent

      root.children.push(para1, para2);
      para1.children.push(text); // but text is actually in para1's children
      // This creates inconsistency: text.parent = para2 but para1.children includes text

      const isValid = tree.validateTree();
      expect(isValid).toBe(false);
    });

    test('validateTree should detect when parent does not include node in children', () => {
      const root = tree.getRoot();
      const para = createElementNode('p', { parent: root, depth: 1 });
      const text = createTextNode('Hello', { parent: para, depth: 2 });

      // Add para to root normally
      root.children.push(para);

      // Add text to para's children, then remove it but keep parent reference
      para.children.push(text);
      para.children.splice(0, 1); // Remove text from para.children

      // Now add text directly to root so it gets traversed
      root.children.push(text);
      // text.parent = para but para.children doesn't include text

      const isValid = tree.validateTree();
      expect(isValid).toBe(false);
    });
  });
});
