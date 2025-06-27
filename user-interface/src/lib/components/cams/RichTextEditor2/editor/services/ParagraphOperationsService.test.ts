import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  createParagraphNode,
  findParagraphNode,
  isParagraphNode,
  splitParagraphAtCursor,
  mergeParagraphs,
  insertParagraphAfter,
  findParagraphBoundaries,
  getParagraphContent,
  moveCursorToParagraphStart,
  moveCursorToParagraphEnd,
} from './ParagraphOperationsService';
import { createElementNode, createTextNode, createRootNode } from '../../virtual-dom/VNodeFactory';
import { VNode, ElementNode, TextNode } from '../../virtual-dom/VNode';

describe('ParagraphOperationsService', () => {
  let _mockRoot: VNode;
  let _mockParagraph: ElementNode;
  let _mockTextNode: TextNode;

  beforeEach(() => {
    vi.restoreAllMocks();
    _mockRoot = createRootNode();
    _mockParagraph = createElementNode('p');
    _mockTextNode = createTextNode('Hello world');
  });

  describe('createParagraphNode', () => {
    test('should create a paragraph element node with p tag', () => {
      const paragraph = createParagraphNode();

      expect(paragraph.tagName).toBe('p');
      expect(paragraph.type).toBe('element');
      expect(paragraph.children).toEqual([]);
      expect(paragraph.attributes).toEqual({});
    });

    test('should create paragraph with custom attributes', () => {
      const paragraph = createParagraphNode({ class: 'custom-paragraph' });

      expect(paragraph.tagName).toBe('p');
      expect(paragraph.attributes).toEqual({ class: 'custom-paragraph' });
    });

    test('should create paragraph with text content', () => {
      const paragraph = createParagraphNode({}, 'Hello world');

      expect(paragraph.tagName).toBe('p');
      expect(paragraph.children).toHaveLength(1);
      expect(paragraph.children[0].type).toBe('text');
      expect((paragraph.children[0] as TextNode).content).toBe('Hello world');
    });
  });

  describe('isParagraphNode', () => {
    test('should return true for paragraph element nodes', () => {
      const paragraph = createElementNode('p');
      expect(isParagraphNode(paragraph)).toBe(true);
    });

    test('should return false for non-paragraph element nodes', () => {
      const div = createElementNode('div');
      expect(isParagraphNode(div)).toBe(false);
    });

    test('should return false for text nodes', () => {
      const textNode = createTextNode('text');
      expect(isParagraphNode(textNode)).toBe(false);
    });

    test('should return false for formatting nodes', () => {
      const strong = createElementNode('strong');
      expect(isParagraphNode(strong)).toBe(false);
    });
  });

  describe('findParagraphNode', () => {
    test('should find paragraph node containing given element', () => {
      const paragraph = createElementNode('p');
      const textNode = createTextNode('Hello');
      paragraph.children.push(textNode);
      textNode.parent = paragraph;

      const result = findParagraphNode(textNode);
      expect(result).toBe(paragraph);
    });

    test('should find paragraph node through nested elements', () => {
      const paragraph = createElementNode('p');
      const strong = createElementNode('strong');
      const textNode = createTextNode('Bold text');

      paragraph.children.push(strong);
      strong.parent = paragraph;
      strong.children.push(textNode);
      textNode.parent = strong;

      const result = findParagraphNode(textNode);
      expect(result).toBe(paragraph);
    });

    test('should return null if no paragraph ancestor found', () => {
      const div = createElementNode('div');
      const textNode = createTextNode('Text');
      div.children.push(textNode);
      textNode.parent = div;

      const result = findParagraphNode(textNode);
      expect(result).toBeNull();
    });

    test('should return the node itself if it is a paragraph', () => {
      const paragraph = createElementNode('p');
      const result = findParagraphNode(paragraph);
      expect(result).toBe(paragraph);
    });
  });

  describe('findParagraphBoundaries', () => {
    test('should find start and end positions of paragraph content', () => {
      const paragraph = createElementNode('p', { startOffset: 10, endOffset: 25 });
      const textNode = createTextNode('Hello world', { startOffset: 10, endOffset: 21 });
      paragraph.children.push(textNode);
      textNode.parent = paragraph;

      const boundaries = findParagraphBoundaries(paragraph);
      expect(boundaries.start).toBe(10);
      expect(boundaries.end).toBe(25);
    });

    test('should handle empty paragraph', () => {
      const paragraph = createElementNode('p', { startOffset: 5, endOffset: 5 });

      const boundaries = findParagraphBoundaries(paragraph);
      expect(boundaries.start).toBe(5);
      expect(boundaries.end).toBe(5);
    });
  });

  describe('getParagraphContent', () => {
    test('should extract text content from paragraph', () => {
      const paragraph = createElementNode('p');
      const textNode1 = createTextNode('Hello ');
      const textNode2 = createTextNode('world');
      paragraph.children.push(textNode1, textNode2);
      textNode1.parent = paragraph;
      textNode2.parent = paragraph;

      const content = getParagraphContent(paragraph);
      expect(content).toBe('Hello world');
    });

    test('should extract content from nested formatting', () => {
      const paragraph = createElementNode('p');
      const textNode1 = createTextNode('Hello ');
      const strong = createElementNode('strong');
      const boldText = createTextNode('bold');
      const textNode2 = createTextNode(' world');

      paragraph.children.push(textNode1, strong, textNode2);
      strong.children.push(boldText);
      textNode1.parent = paragraph;
      strong.parent = paragraph;
      boldText.parent = strong;
      textNode2.parent = paragraph;

      const content = getParagraphContent(paragraph);
      expect(content).toBe('Hello bold world');
    });

    test('should return empty string for empty paragraph', () => {
      const paragraph = createElementNode('p');
      const content = getParagraphContent(paragraph);
      expect(content).toBe('');
    });
  });

  describe('splitParagraphAtCursor', () => {
    test('should split paragraph at cursor position', () => {
      const paragraph = createElementNode('p', { startOffset: 0, endOffset: 11 });
      const textNode = createTextNode('Hello world', { startOffset: 0, endOffset: 11 });
      paragraph.children.push(textNode);
      textNode.parent = paragraph;

      const result = splitParagraphAtCursor(paragraph, 5); // Split at "Hello|world"

      expect(result.firstParagraph.children).toHaveLength(1);
      expect(result.secondParagraph.children).toHaveLength(1);
      expect((result.firstParagraph.children[0] as TextNode).content).toBe('Hello');
      expect((result.secondParagraph.children[0] as TextNode).content).toBe(' world');
    });

    test('should handle split at beginning of paragraph', () => {
      const paragraph = createElementNode('p', { startOffset: 0, endOffset: 11 });
      const textNode = createTextNode('Hello world', { startOffset: 0, endOffset: 11 });
      paragraph.children.push(textNode);
      textNode.parent = paragraph;

      const result = splitParagraphAtCursor(paragraph, 0);

      expect(result.firstParagraph.children).toHaveLength(0);
      expect(result.secondParagraph.children).toHaveLength(1);
      expect((result.secondParagraph.children[0] as TextNode).content).toBe('Hello world');
    });

    test('should handle split at end of paragraph', () => {
      const paragraph = createElementNode('p', { startOffset: 0, endOffset: 11 });
      const textNode = createTextNode('Hello world', { startOffset: 0, endOffset: 11 });
      paragraph.children.push(textNode);
      textNode.parent = paragraph;

      const result = splitParagraphAtCursor(paragraph, 11);

      expect(result.firstParagraph.children).toHaveLength(1);
      expect(result.secondParagraph.children).toHaveLength(0);
      expect((result.firstParagraph.children[0] as TextNode).content).toBe('Hello world');
    });
  });

  describe('mergeParagraphs', () => {
    test('should merge two paragraphs into one', () => {
      const firstParagraph = createElementNode('p');
      const secondParagraph = createElementNode('p');
      const textNode1 = createTextNode('Hello ');
      const textNode2 = createTextNode('world');

      firstParagraph.children.push(textNode1);
      secondParagraph.children.push(textNode2);
      textNode1.parent = firstParagraph;
      textNode2.parent = secondParagraph;

      const merged = mergeParagraphs(firstParagraph, secondParagraph);

      expect(merged.children).toHaveLength(2);
      expect((merged.children[0] as TextNode).content).toBe('Hello ');
      expect((merged.children[1] as TextNode).content).toBe('world');
    });

    test('should handle merging empty paragraphs', () => {
      const firstParagraph = createElementNode('p');
      const secondParagraph = createElementNode('p');

      const merged = mergeParagraphs(firstParagraph, secondParagraph);

      expect(merged.children).toHaveLength(0);
    });

    test('should preserve formatting when merging', () => {
      const firstParagraph = createElementNode('p');
      const secondParagraph = createElementNode('p');
      const textNode = createTextNode('Hello ');
      const strong = createElementNode('strong');
      const boldText = createTextNode('world');

      firstParagraph.children.push(textNode);
      secondParagraph.children.push(strong);
      strong.children.push(boldText);
      textNode.parent = firstParagraph;
      strong.parent = secondParagraph;
      boldText.parent = strong;

      const merged = mergeParagraphs(firstParagraph, secondParagraph);

      expect(merged.children).toHaveLength(2);
      expect((merged.children[0] as TextNode).content).toBe('Hello ');
      expect(merged.children[1].tagName).toBe('strong');
      expect((merged.children[1].children[0] as TextNode).content).toBe('world');
    });
  });

  describe('insertParagraphAfter', () => {
    test('should insert new paragraph after existing paragraph', () => {
      const root = createRootNode();
      const existingParagraph = createElementNode('p');
      const textNode = createTextNode('Existing');
      existingParagraph.children.push(textNode);
      textNode.parent = existingParagraph;
      root.children.push(existingParagraph);
      existingParagraph.parent = root;

      const newParagraph = insertParagraphAfter(existingParagraph, 'New content');

      expect(root.children).toHaveLength(2);
      expect(root.children[1]).toBe(newParagraph);
      expect(newParagraph.tagName).toBe('p');
      expect((newParagraph.children[0] as TextNode).content).toBe('New content');
    });

    test('should handle inserting empty paragraph', () => {
      const root = createRootNode();
      const existingParagraph = createElementNode('p');
      root.children.push(existingParagraph);
      existingParagraph.parent = root;

      const newParagraph = insertParagraphAfter(existingParagraph);

      expect(root.children).toHaveLength(2);
      expect(newParagraph.children).toHaveLength(0);
    });
  });

  describe('cursor positioning', () => {
    describe('moveCursorToParagraphStart', () => {
      test('should return start position of paragraph', () => {
        const paragraph = createElementNode('p', { startOffset: 10, endOffset: 25 });
        const position = moveCursorToParagraphStart(paragraph);
        expect(position).toBe(10);
      });
    });

    describe('moveCursorToParagraphEnd', () => {
      test('should return end position of paragraph', () => {
        const paragraph = createElementNode('p', { startOffset: 10, endOffset: 25 });
        const position = moveCursorToParagraphEnd(paragraph);
        expect(position).toBe(25);
      });
    });
  });
});
