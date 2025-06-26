import { describe, test, expect, beforeEach } from 'vitest';
import { VNode } from './VNode';
import {
  createTextNode,
  createElementNode,
  createRootNode,
  resetNodeIdCounter,
} from './VNodeFactory';
import { VirtualDOMTree } from './VirtualDOMTree';
import {
  insertNode,
  removeNode,
  replaceNode,
  moveNode,
  insertTextContent,
  removeTextContent,
  splitTextNode,
  mergeTextNodes,
} from './VirtualDOMOperations';

describe('VirtualDOMOperations', () => {
  let tree: VirtualDOMTree;
  let root: VNode;

  beforeEach(() => {
    resetNodeIdCounter();
    tree = new VirtualDOMTree();
    root = tree.getRoot();
  });

  describe('insertNode', () => {
    test('should insert child node at the end when no index provided', () => {
      const paragraph = createElementNode('p', { parent: root, depth: 1 });

      insertNode(root, paragraph);

      expect(root.children).toContain(paragraph);
      expect(root.children).toHaveLength(1);
      expect(paragraph.parent).toBe(root);
    });

    test('should insert child node at specific index', () => {
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const para3 = createElementNode('p', { parent: root, depth: 1 });

      insertNode(root, para1);
      insertNode(root, para3);
      insertNode(root, para2, 1); // Insert at index 1

      expect(root.children).toEqual([para1, para2, para3]);
    });

    test('should update node parent and depth', () => {
      const paragraph = createElementNode('p');

      insertNode(root, paragraph);

      expect(paragraph.parent).toBe(root);
      expect(paragraph.depth).toBe(1);
    });

    test('should handle insertion at index 0', () => {
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });

      insertNode(root, para1);
      insertNode(root, para2, 0); // Insert at beginning

      expect(root.children).toEqual([para2, para1]);
    });

    test('should handle invalid index by appending to end', () => {
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });

      insertNode(root, para1);
      insertNode(root, para2, 999); // Invalid high index

      expect(root.children).toEqual([para1, para2]);
    });

    test('should update depths of all descendants', () => {
      const paragraph = createElementNode('p');
      const textNode = createTextNode('Hello', { parent: paragraph, depth: 2 });
      paragraph.children.push(textNode);

      insertNode(root, paragraph);

      expect(paragraph.depth).toBe(1);
      expect(textNode.depth).toBe(2);
    });
  });

  describe('removeNode', () => {
    test('should remove node from parent', () => {
      const paragraph = createElementNode('p', { parent: root, depth: 1 });
      root.children.push(paragraph);

      const removed = removeNode(paragraph);

      expect(root.children).not.toContain(paragraph);
      expect(removed).toBe(paragraph);
      expect(paragraph.parent).toBeNull();
    });

    test('should return null when trying to remove root node', () => {
      const removed = removeNode(root);

      expect(removed).toBeNull();
    });

    test('should return null when trying to remove orphaned node', () => {
      const paragraph = createElementNode('p');

      const removed = removeNode(paragraph);

      expect(removed).toBeNull();
    });

    test('should remove node from middle of siblings list', () => {
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const para3 = createElementNode('p', { parent: root, depth: 1 });

      root.children.push(para1, para2, para3);

      removeNode(para2);

      expect(root.children).toEqual([para1, para3]);
    });

    test('should preserve node children when removed', () => {
      const paragraph = createElementNode('p', { parent: root, depth: 1 });
      const textNode = createTextNode('Hello', { parent: paragraph, depth: 2 });
      paragraph.children.push(textNode);
      root.children.push(paragraph);

      const removed = removeNode(paragraph);

      expect(removed?.children).toContain(textNode);
      expect(textNode.parent).toBe(paragraph);
    });
  });

  describe('replaceNode', () => {
    test('should replace old node with new node', () => {
      const oldPara = createElementNode('p', { parent: root, depth: 1 });
      const newPara = createElementNode('div');
      root.children.push(oldPara);

      const replaced = replaceNode(oldPara, newPara);

      expect(root.children).toContain(newPara);
      expect(root.children).not.toContain(oldPara);
      expect(replaced).toBe(oldPara);
      expect(newPara.parent).toBe(root);
      expect(newPara.depth).toBe(1);
    });

    test('should maintain position in siblings list', () => {
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const para3 = createElementNode('p', { parent: root, depth: 1 });
      const newPara = createElementNode('div');

      root.children.push(para1, para2, para3);

      replaceNode(para2, newPara);

      expect(root.children).toEqual([para1, newPara, para3]);
    });

    test('should return null when trying to replace root', () => {
      const newRoot = createRootNode();

      const replaced = replaceNode(root, newRoot);

      expect(replaced).toBeNull();
    });

    test('should return null when trying to replace orphaned node', () => {
      const oldPara = createElementNode('p');
      const newPara = createElementNode('div');

      const replaced = replaceNode(oldPara, newPara);

      expect(replaced).toBeNull();
    });

    test('should update depths of new node and descendants', () => {
      const oldPara = createElementNode('p', { parent: root, depth: 1 });
      const newPara = createElementNode('div');
      const textNode = createTextNode('Hello', { parent: newPara, depth: 0 });
      newPara.children.push(textNode);
      root.children.push(oldPara);

      replaceNode(oldPara, newPara);

      expect(newPara.depth).toBe(1);
      expect(textNode.depth).toBe(2);
    });
  });

  describe('moveNode', () => {
    test('should move node to new parent', () => {
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const textNode = createTextNode('Hello', { parent: para1, depth: 2 });

      root.children.push(para1, para2);
      para1.children.push(textNode);

      const moved = moveNode(textNode, para2);

      expect(para1.children).not.toContain(textNode);
      expect(para2.children).toContain(textNode);
      expect(textNode.parent).toBe(para2);
      expect(moved).toBe(textNode);
    });

    test('should move node to specific index in new parent', () => {
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const text1 = createTextNode('First', { parent: para1, depth: 2 });
      const text2 = createTextNode('Second', { parent: para1, depth: 2 });
      const text3 = createTextNode('Third', { parent: para1, depth: 2 });

      root.children.push(para1);
      para1.children.push(text1, text2, text3);

      moveNode(text3, para1, 1); // Move to index 1

      expect(para1.children).toEqual([text1, text3, text2]);
    });

    test('should return null when trying to move root', () => {
      const newParent = createElementNode('div');

      const moved = moveNode(root, newParent);

      expect(moved).toBeNull();
    });

    test('should update depths when moving between different levels', () => {
      const para = createElementNode('p', { parent: root, depth: 1 });
      const textNode = createTextNode('Hello', { parent: root, depth: 1 });

      root.children.push(para, textNode);

      moveNode(textNode, para);

      expect(textNode.depth).toBe(2);
      expect(textNode.parent).toBe(para);
    });
  });

  describe('insertTextContent', () => {
    test('should insert text into existing text node', () => {
      const textNode = createTextNode('Hello World', { parent: root, depth: 1 });
      root.children.push(textNode);

      const result = insertTextContent(textNode, 6, 'Amazing ');

      expect(result.content).toBe('Hello Amazing World');
      expect(result.endOffset).toBe(textNode.startOffset + 19); // New length
    });

    test('should handle insertion at beginning', () => {
      const textNode = createTextNode('World', { parent: root, depth: 1 });
      root.children.push(textNode);

      const result = insertTextContent(textNode, 0, 'Hello ');

      expect(result.content).toBe('Hello World');
    });

    test('should handle insertion at end', () => {
      const textNode = createTextNode('Hello', { parent: root, depth: 1 });
      root.children.push(textNode);

      const result = insertTextContent(textNode, 5, ' World');

      expect(result.content).toBe('Hello World');
    });

    test('should handle invalid offset by appending', () => {
      const textNode = createTextNode('Hello', { parent: root, depth: 1 });
      root.children.push(textNode);

      const result = insertTextContent(textNode, 999, ' World');

      expect(result.content).toBe('Hello World');
    });
  });

  describe('removeTextContent', () => {
    test('should remove text from text node', () => {
      const textNode = createTextNode('Hello Amazing World', { parent: root, depth: 1 });
      root.children.push(textNode);

      const result = removeTextContent(textNode, 6, 14); // Remove "Amazing "

      expect(result.content).toBe('Hello World');
      expect(result.endOffset).toBe(textNode.startOffset + 11);
    });

    test('should handle removal from beginning', () => {
      const textNode = createTextNode('Hello World', { parent: root, depth: 1 });
      root.children.push(textNode);

      const result = removeTextContent(textNode, 0, 6); // Remove "Hello "

      expect(result.content).toBe('World');
    });

    test('should handle removal to end', () => {
      const textNode = createTextNode('Hello World', { parent: root, depth: 1 });
      root.children.push(textNode);

      const result = removeTextContent(textNode, 5); // Remove " World"

      expect(result.content).toBe('Hello');
    });

    test('should handle invalid ranges safely', () => {
      const textNode = createTextNode('Hello', { parent: root, depth: 1 });
      root.children.push(textNode);

      const result = removeTextContent(textNode, 999, 1000);

      expect(result.content).toBe('Hello'); // No change
    });
  });

  describe('splitTextNode', () => {
    test('should split text node at specified offset', () => {
      const textNode = createTextNode('Hello World', { parent: root, depth: 1 });
      root.children.push(textNode);

      const [left, right] = splitTextNode(textNode, 6);

      expect(left.content).toBe('Hello ');
      expect(right.content).toBe('World');
      expect(left.parent).toBe(root);
      expect(right.parent).toBe(root);
      expect(root.children).toContain(left);
      expect(root.children).toContain(right);
      expect(root.children).not.toContain(textNode);
    });

    test('should handle split at beginning', () => {
      const textNode = createTextNode('Hello', { parent: root, depth: 1 });
      root.children.push(textNode);

      const [left, right] = splitTextNode(textNode, 0);

      expect(left.content).toBe('');
      expect(right.content).toBe('Hello');
    });

    test('should handle split at end', () => {
      const textNode = createTextNode('Hello', { parent: root, depth: 1 });
      root.children.push(textNode);

      const [left, right] = splitTextNode(textNode, 5);

      expect(left.content).toBe('Hello');
      expect(right.content).toBe('');
    });

    test('should maintain sibling order', () => {
      const text1 = createTextNode('First', { parent: root, depth: 1 });
      const text2 = createTextNode('Hello World', { parent: root, depth: 1 });
      const text3 = createTextNode('Last', { parent: root, depth: 1 });

      root.children.push(text1, text2, text3);

      const [left, right] = splitTextNode(text2, 6);

      expect(root.children).toEqual([text1, left, right, text3]);
    });
  });

  describe('mergeTextNodes', () => {
    test('should merge two adjacent text nodes', () => {
      const text1 = createTextNode('Hello ', { parent: root, depth: 1 });
      const text2 = createTextNode('World', { parent: root, depth: 1 });

      root.children.push(text1, text2);

      const merged = mergeTextNodes(text1, text2);

      expect(merged).not.toBeNull();
      expect(merged!.content).toBe('Hello World');
      expect(root.children).toContain(merged);
      expect(root.children).not.toContain(text1);
      expect(root.children).not.toContain(text2);
    });

    test('should return null when nodes have different parents', () => {
      const para1 = createElementNode('p', { parent: root, depth: 1 });
      const para2 = createElementNode('p', { parent: root, depth: 1 });
      const text1 = createTextNode('Hello', { parent: para1, depth: 2 });
      const text2 = createTextNode('World', { parent: para2, depth: 2 });

      para1.children.push(text1);
      para2.children.push(text2);

      const merged = mergeTextNodes(text1, text2);

      expect(merged).toBeNull();
    });

    test('should return null when nodes are not adjacent', () => {
      const text1 = createTextNode('Hello', { parent: root, depth: 1 });
      const text2 = createTextNode('Middle', { parent: root, depth: 1 });
      const text3 = createTextNode('World', { parent: root, depth: 1 });

      root.children.push(text1, text2, text3);

      const merged = mergeTextNodes(text1, text3);

      expect(merged).toBeNull();
    });

    test('should handle merging in reverse order', () => {
      const text1 = createTextNode('Hello ', { parent: root, depth: 1 });
      const text2 = createTextNode('World', { parent: root, depth: 1 });

      root.children.push(text1, text2);

      const merged = mergeTextNodes(text2, text1); // Reverse order

      expect(merged).not.toBeNull();
      expect(merged!.content).toBe('Hello World');
    });
  });
});
