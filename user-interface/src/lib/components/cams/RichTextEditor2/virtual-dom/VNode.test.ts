import { describe, test, expect } from 'vitest';
import { VNodeType, VNode, TextNode, ElementNode, FormattingNode, RootNode } from './VNode';

describe('VNode Types and Interfaces', () => {
  describe('VNodeType enum', () => {
    test('should have all required node types', () => {
      expect(VNodeType.TEXT).toBe('text');
      expect(VNodeType.ELEMENT).toBe('element');
      expect(VNodeType.FORMATTING).toBe('formatting');
      expect(VNodeType.ROOT).toBe('root');
    });
  });

  describe('VNode base interface', () => {
    test('should define the base structure for all nodes', () => {
      const mockNode: VNode = {
        id: 'test-id',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 0,
      };

      expect(mockNode.id).toBe('test-id');
      expect(mockNode.type).toBe(VNodeType.TEXT);
      expect(mockNode.parent).toBeNull();
      expect(mockNode.children).toEqual([]);
      expect(mockNode.startOffset).toBe(0);
      expect(mockNode.endOffset).toBe(5);
      expect(mockNode.depth).toBe(0);
    });
  });

  describe('TextNode interface', () => {
    test('should extend VNode with text content', () => {
      const textNode: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 11,
        depth: 1,
        content: 'Hello World',
      };

      expect(textNode.type).toBe(VNodeType.TEXT);
      expect(textNode.content).toBe('Hello World');
      expect(textNode.children).toEqual([]); // Text nodes should not have children
    });

    test('should enforce text type constraint', () => {
      const textNode: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 1,
        content: 'Hello',
      };

      // Type should be enforced at compile time
      expect(textNode.type).toBe(VNodeType.TEXT);
    });
  });

  describe('ElementNode interface', () => {
    test('should extend VNode with element properties', () => {
      const elementNode: ElementNode = {
        id: 'elem-1',
        type: VNodeType.ELEMENT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 10,
        depth: 0,
        tagName: 'p',
        attributes: { class: 'paragraph' },
      };

      expect(elementNode.type).toBe(VNodeType.ELEMENT);
      expect(elementNode.tagName).toBe('p');
      expect(elementNode.attributes).toEqual({ class: 'paragraph' });
    });

    test('should support common HTML elements', () => {
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
        const node: ElementNode = {
          id: `elem-${tag}`,
          type: VNodeType.ELEMENT,
          parent: null,
          children: [],
          startOffset: 0,
          endOffset: 0,
          depth: 0,
          tagName: tag,
          attributes: {},
        };

        expect(node.tagName).toBe(tag);
      });
    });

    test('should handle attributes as optional', () => {
      const elementNode: ElementNode = {
        id: 'elem-1',
        type: VNodeType.ELEMENT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 0,
        depth: 0,
        tagName: 'p',
        attributes: {},
      };

      expect(elementNode.attributes).toEqual({});
    });
  });

  describe('FormattingNode interface', () => {
    test('should extend VNode with formatting properties', () => {
      const formattingNode: FormattingNode = {
        id: 'format-1',
        type: VNodeType.FORMATTING,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 1,
        formatType: 'bold',
        tagName: 'strong',
      };

      expect(formattingNode.type).toBe(VNodeType.FORMATTING);
      expect(formattingNode.formatType).toBe('bold');
      expect(formattingNode.tagName).toBe('strong');
    });

    test('should support all required formatting types', () => {
      const formattingTypes = ['bold', 'italic', 'underline'];

      formattingTypes.forEach((formatType) => {
        const node: FormattingNode = {
          id: `format-${formatType}`,
          type: VNodeType.FORMATTING,
          parent: null,
          children: [],
          startOffset: 0,
          endOffset: 0,
          depth: 1,
          formatType: formatType as 'bold' | 'italic' | 'underline',
          tagName: formatType === 'bold' ? 'strong' : formatType === 'italic' ? 'em' : 'u',
        };

        expect(node.formatType).toBe(formatType);
      });
    });
  });

  describe('RootNode interface', () => {
    test('should extend VNode as document root', () => {
      const rootNode: RootNode = {
        id: 'root',
        type: VNodeType.ROOT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 0,
        depth: 0,
      };

      expect(rootNode.type).toBe(VNodeType.ROOT);
      expect(rootNode.parent).toBeNull(); // Root should never have a parent
      expect(rootNode.depth).toBe(0); // Root is always at depth 0
    });
  });

  describe('Type guards', () => {
    test('should correctly identify TextNode', () => {
      const textNode: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 1,
        content: 'Hello',
      };

      // Type guard function will be implemented
      expect(textNode.type === VNodeType.TEXT).toBe(true);
    });

    test('should correctly identify ElementNode', () => {
      const elementNode: ElementNode = {
        id: 'elem-1',
        type: VNodeType.ELEMENT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 0,
        depth: 0,
        tagName: 'p',
        attributes: {},
      };

      expect(elementNode.type === VNodeType.ELEMENT).toBe(true);
    });
  });
});
