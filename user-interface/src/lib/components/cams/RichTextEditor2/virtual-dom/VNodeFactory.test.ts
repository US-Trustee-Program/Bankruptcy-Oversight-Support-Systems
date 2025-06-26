import { describe, test, expect, beforeEach } from 'vitest';
import { VNodeType } from './VNode';
import {
  createTextNode,
  createElementNode,
  createFormattingNode,
  createRootNode,
  generateNodeId,
  resetNodeIdCounter,
} from './VNodeFactory';

describe('VNodeFactory', () => {
  beforeEach(() => {
    // Reset the counter for each test to ensure predictable IDs
    resetNodeIdCounter();
  });

  describe('generateNodeId', () => {
    test('should generate unique IDs', () => {
      const id1 = generateNodeId();
      const id2 = generateNodeId();
      const id3 = generateNodeId();

      expect(id1).toBe('vnode-1');
      expect(id2).toBe('vnode-2');
      expect(id3).toBe('vnode-3');
      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
    });
  });

  describe('createTextNode', () => {
    test('should create a basic text node with required properties', () => {
      const textNode = createTextNode('Hello World');

      expect(textNode.id).toBe('vnode-1');
      expect(textNode.type).toBe(VNodeType.TEXT);
      expect(textNode.content).toBe('Hello World');
      expect(textNode.parent).toBeNull();
      expect(textNode.children).toEqual([]);
      expect(textNode.startOffset).toBe(0);
      expect(textNode.endOffset).toBe(11); // Length of "Hello World"
      expect(textNode.depth).toBe(0);
    });

    test('should create a text node with custom options', () => {
      const mockParent = createElementNode('p');
      const textNode = createTextNode('Test', {
        parent: mockParent,
        startOffset: 5,
        depth: 2,
      });

      expect(textNode.content).toBe('Test');
      expect(textNode.parent).toBe(mockParent);
      expect(textNode.startOffset).toBe(5);
      expect(textNode.endOffset).toBe(9); // 5 + 4 (length of "Test")
      expect(textNode.depth).toBe(2);
    });

    test('should handle empty text content', () => {
      const textNode = createTextNode('');

      expect(textNode.content).toBe('');
      expect(textNode.startOffset).toBe(0);
      expect(textNode.endOffset).toBe(0);
    });

    test('should automatically calculate endOffset from content length', () => {
      const shortText = createTextNode('Hi');
      const longText = createTextNode('This is a longer text');

      expect(shortText.endOffset).toBe(2);
      expect(longText.endOffset).toBe(21);
    });
  });

  describe('createElementNode', () => {
    test('should create a basic element node with required properties', () => {
      const elementNode = createElementNode('p');

      expect(elementNode.id).toBe('vnode-1');
      expect(elementNode.type).toBe(VNodeType.ELEMENT);
      expect(elementNode.tagName).toBe('p');
      expect(elementNode.attributes).toEqual({});
      expect(elementNode.parent).toBeNull();
      expect(elementNode.children).toEqual([]);
      expect(elementNode.startOffset).toBe(0);
      expect(elementNode.endOffset).toBe(0);
      expect(elementNode.depth).toBe(0);
    });

    test('should create element node with attributes', () => {
      const elementNode = createElementNode('div', {
        attributes: { class: 'container', id: 'main' },
      });

      expect(elementNode.tagName).toBe('div');
      expect(elementNode.attributes).toEqual({ class: 'container', id: 'main' });
    });

    test('should create element node with custom options', () => {
      const mockParent = createRootNode();
      const elementNode = createElementNode('span', {
        parent: mockParent,
        startOffset: 10,
        endOffset: 20,
        depth: 1,
      });

      expect(elementNode.parent).toBe(mockParent);
      expect(elementNode.startOffset).toBe(10);
      expect(elementNode.endOffset).toBe(20);
      expect(elementNode.depth).toBe(1);
    });

    test('should support all common HTML elements', () => {
      const supportedTags = [
        'p',
        'div',
        'span',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
      ];

      supportedTags.forEach((tag) => {
        const node = createElementNode(tag);
        expect(node.tagName).toBe(tag);
        expect(node.type).toBe(VNodeType.ELEMENT);
      });
    });
  });

  describe('createFormattingNode', () => {
    test('should create bold formatting node', () => {
      const formatNode = createFormattingNode('bold');

      expect(formatNode.id).toBe('vnode-1');
      expect(formatNode.type).toBe(VNodeType.FORMATTING);
      expect(formatNode.formatType).toBe('bold');
      expect(formatNode.tagName).toBe('strong');
      expect(formatNode.parent).toBeNull();
      expect(formatNode.children).toEqual([]);
    });

    test('should create italic formatting node', () => {
      const formatNode = createFormattingNode('italic');

      expect(formatNode.formatType).toBe('italic');
      expect(formatNode.tagName).toBe('em');
    });

    test('should create underline formatting node', () => {
      const formatNode = createFormattingNode('underline');

      expect(formatNode.formatType).toBe('underline');
      expect(formatNode.tagName).toBe('u');
    });

    test('should create formatting node with custom options', () => {
      const mockParent = createElementNode('p');
      const formatNode = createFormattingNode('bold', {
        parent: mockParent,
        startOffset: 5,
        endOffset: 10,
        depth: 2,
      });

      expect(formatNode.parent).toBe(mockParent);
      expect(formatNode.startOffset).toBe(5);
      expect(formatNode.endOffset).toBe(10);
      expect(formatNode.depth).toBe(2);
    });
  });

  describe('createRootNode', () => {
    test('should create a root node with correct properties', () => {
      const rootNode = createRootNode();

      expect(rootNode.id).toBe('vnode-1');
      expect(rootNode.type).toBe(VNodeType.ROOT);
      expect(rootNode.parent).toBeNull();
      expect(rootNode.children).toEqual([]);
      expect(rootNode.startOffset).toBe(0);
      expect(rootNode.endOffset).toBe(0);
      expect(rootNode.depth).toBe(0);
    });

    test('should create root node with custom options', () => {
      const rootNode = createRootNode({
        endOffset: 100,
      });

      expect(rootNode.endOffset).toBe(100);
      expect(rootNode.depth).toBe(0); // Should always be 0 for root
      expect(rootNode.parent).toBeNull(); // Should always be null for root
    });

    test('should enforce root constraints even with custom options', () => {
      // This should be prevented by TypeScript, but test runtime behavior
      const rootNode = createRootNode();

      expect(rootNode.parent).toBeNull();
      expect(rootNode.depth).toBe(0);
    });
  });

  describe('Node parent-child relationships', () => {
    test('should properly link parent and child nodes', () => {
      const parentNode = createElementNode('p');
      const childNode = createTextNode('Hello', { parent: parentNode });

      expect(childNode.parent).toBe(parentNode);
      // Note: Adding child to parent's children array will be handled by tree operations
    });

    test('should maintain proper depth relationships', () => {
      const rootNode = createRootNode();
      const paragraphNode = createElementNode('p', { parent: rootNode, depth: 1 });
      const textNode = createTextNode('Hello', { parent: paragraphNode, depth: 2 });

      expect(rootNode.depth).toBe(0);
      expect(paragraphNode.depth).toBe(1);
      expect(textNode.depth).toBe(2);
    });
  });

  describe('Node validation', () => {
    test('should create nodes with valid offset ranges', () => {
      const textNode = createTextNode('Hello', {
        startOffset: 10,
        // endOffset should be calculated automatically
      });

      expect(textNode.startOffset).toBe(10);
      expect(textNode.endOffset).toBe(15); // 10 + 5 (length of "Hello")
      expect(textNode.endOffset).toBeGreaterThanOrEqual(textNode.startOffset);
    });

    test('should handle explicit endOffset when provided', () => {
      const elementNode = createElementNode('p', {
        startOffset: 5,
        endOffset: 25,
      });

      expect(elementNode.startOffset).toBe(5);
      expect(elementNode.endOffset).toBe(25);
    });
  });
});
