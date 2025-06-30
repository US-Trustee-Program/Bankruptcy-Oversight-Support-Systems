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
  getCursorPositionInParagraph,
  setCursorPositionInParagraph,
  findParagraphAtCursor,
  preserveCursorPositionDuringUpdate,
  applyFormattingToParagraph,
  removeFormattingFromParagraph,
  applyFormattingToMultipleParagraphs,
} from './ParagraphOperationsService';
import { createElementNode, createTextNode, createRootNode } from '../../virtual-dom/VNodeFactory';
import { VNode, ElementNode, TextNode } from '../../virtual-dom/VNode';

describe('ParagraphOperationsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    test('should return correct boundaries for paragraph with different offsets', () => {
      const paragraph = createElementNode('p', { startOffset: 0, endOffset: 100 });

      const boundaries = findParagraphBoundaries(paragraph);
      expect(boundaries.start).toBe(0);
      expect(boundaries.end).toBe(100);
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

    test('should handle split with nested element nodes', () => {
      const paragraph = createElementNode('p', { startOffset: 0, endOffset: 20 });
      const textNode1 = createTextNode('Hello ');
      const strongElement = createElementNode('strong');
      const boldText = createTextNode('bold');
      const textNode2 = createTextNode(' world');

      // Build nested structure: <p>Hello <strong>bold</strong> world</p>
      paragraph.children.push(textNode1, strongElement, textNode2);
      strongElement.children.push(boldText);
      textNode1.parent = paragraph;
      strongElement.parent = paragraph;
      boldText.parent = strongElement;
      textNode2.parent = paragraph;

      // Split in the middle - this will exercise getElementContentLength
      const result = splitParagraphAtCursor(paragraph, 10);

      expect(result.firstParagraph.children.length).toBeGreaterThan(0);
      expect(result.secondParagraph.children.length).toBeGreaterThan(0);
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
      expect((merged.children[1] as ElementNode).tagName).toBe('strong');
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

    describe('getCursorPositionInParagraph', () => {
      test('should calculate relative position within paragraph', () => {
        const paragraph = createElementNode('p', { startOffset: 10, endOffset: 25 });

        // Test position at start
        expect(getCursorPositionInParagraph(paragraph, 10)).toBe(0);

        // Test position in middle
        expect(getCursorPositionInParagraph(paragraph, 15)).toBe(5);

        // Test position at end
        expect(getCursorPositionInParagraph(paragraph, 25)).toBe(15);
      });

      test('should clamp position to paragraph boundaries', () => {
        const paragraph = createElementNode('p', { startOffset: 10, endOffset: 25 });

        // Test position before paragraph start
        expect(getCursorPositionInParagraph(paragraph, 5)).toBe(0);

        // Test position after paragraph end
        expect(getCursorPositionInParagraph(paragraph, 30)).toBe(15);
      });
    });

    describe('setCursorPositionInParagraph', () => {
      test('should convert relative position to absolute position', () => {
        const paragraph = createElementNode('p', { startOffset: 10, endOffset: 25 });

        // Test position at start
        expect(setCursorPositionInParagraph(paragraph, 0)).toBe(10);

        // Test position in middle
        expect(setCursorPositionInParagraph(paragraph, 5)).toBe(15);

        // Test position at end
        expect(setCursorPositionInParagraph(paragraph, 15)).toBe(25);
      });

      test('should clamp relative position to paragraph length', () => {
        const paragraph = createElementNode('p', { startOffset: 10, endOffset: 25 });

        // Test negative position
        expect(setCursorPositionInParagraph(paragraph, -5)).toBe(10);

        // Test position beyond paragraph length
        expect(setCursorPositionInParagraph(paragraph, 20)).toBe(25);
      });
    });

    describe('findParagraphAtCursor', () => {
      test('should find paragraph containing cursor position', () => {
        const root = createRootNode();
        const paragraph1 = createElementNode('p', { startOffset: 0, endOffset: 10 });
        const paragraph2 = createElementNode('p', { startOffset: 10, endOffset: 20 });

        root.children.push(paragraph1, paragraph2);
        paragraph1.parent = root;
        paragraph2.parent = root;

        // Test cursor in first paragraph
        expect(findParagraphAtCursor(root, 5)).toBe(paragraph1);

        // Test cursor in second paragraph
        expect(findParagraphAtCursor(root, 15)).toBe(paragraph2);

        // Test cursor at paragraph boundary
        expect(findParagraphAtCursor(root, 10)).toBe(paragraph2);
      });

      test('should return null if no paragraph contains cursor', () => {
        const root = createRootNode();
        const paragraph = createElementNode('p', { startOffset: 10, endOffset: 20 });

        root.children.push(paragraph);
        paragraph.parent = root;

        // Test cursor before paragraph
        expect(findParagraphAtCursor(root, 5)).toBeNull();

        // Test cursor after paragraph
        expect(findParagraphAtCursor(root, 25)).toBeNull();
      });

      test('should find nested paragraph', () => {
        const root = createRootNode();
        const container = createElementNode('div');
        const paragraph = createElementNode('p', { startOffset: 5, endOffset: 15 });

        root.children.push(container);
        container.children.push(paragraph);
        container.parent = root;
        paragraph.parent = container;

        expect(findParagraphAtCursor(root, 10)).toBe(paragraph);
      });
    });

    describe('preserveCursorPositionDuringUpdate', () => {
      test('should preserve relative cursor position when paragraph moves', () => {
        const originalParagraph = createElementNode('p', { startOffset: 10, endOffset: 25 });
        const updatedParagraph = createElementNode('p', { startOffset: 20, endOffset: 35 });

        // Cursor at position 15 (relative position 5 in original paragraph)
        const originalCursor = 15;
        const preservedCursor = preserveCursorPositionDuringUpdate(
          originalParagraph,
          updatedParagraph,
          originalCursor,
        );

        // Should be at position 25 (relative position 5 in updated paragraph)
        expect(preservedCursor).toBe(25);
      });

      test('should handle cursor at paragraph boundaries', () => {
        const originalParagraph = createElementNode('p', { startOffset: 10, endOffset: 25 });
        const updatedParagraph = createElementNode('p', { startOffset: 30, endOffset: 45 });

        // Test cursor at start
        expect(preserveCursorPositionDuringUpdate(originalParagraph, updatedParagraph, 10)).toBe(
          30,
        );

        // Test cursor at end
        expect(preserveCursorPositionDuringUpdate(originalParagraph, updatedParagraph, 25)).toBe(
          45,
        );
      });

      test('should handle paragraph size changes', () => {
        const originalParagraph = createElementNode('p', { startOffset: 10, endOffset: 30 });
        const updatedParagraph = createElementNode('p', { startOffset: 10, endOffset: 20 });

        // Cursor at position 25 (relative position 15 in original paragraph)
        // Updated paragraph is shorter, so cursor should be clamped to end
        const preservedCursor = preserveCursorPositionDuringUpdate(
          originalParagraph,
          updatedParagraph,
          25,
        );

        expect(preservedCursor).toBe(20);
      });
    });
  });

  describe('paragraph formatting operations', () => {
    describe('applyFormattingToParagraph', () => {
      test('should apply bold formatting to entire paragraph', () => {
        const paragraph = createElementNode('p');
        const textNode = createTextNode('Hello world');
        paragraph.children.push(textNode);
        textNode.parent = paragraph;

        const formattedParagraph = applyFormattingToParagraph(paragraph, 'bold');

        expect(formattedParagraph.children).toHaveLength(1);
        expect((formattedParagraph.children[0] as ElementNode).tagName).toBe('strong');
        expect((formattedParagraph.children[0].children[0] as TextNode).content).toBe(
          'Hello world',
        );
      });

      test('should apply italic formatting to paragraph with mixed content', () => {
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

        const formattedParagraph = applyFormattingToParagraph(paragraph, 'italic');

        expect(formattedParagraph.children).toHaveLength(1);
        expect((formattedParagraph.children[0] as ElementNode).tagName).toBe('em');
        expect(formattedParagraph.children[0].children).toHaveLength(3);
      });

      test('should handle empty paragraph', () => {
        const paragraph = createElementNode('p');
        const formattedParagraph = applyFormattingToParagraph(paragraph, 'underline');

        expect(formattedParagraph.children).toHaveLength(0);
      });

      test('should preserve existing formatting when applying new formatting', () => {
        const paragraph = createElementNode('p');
        const strong = createElementNode('strong');
        const boldText = createTextNode('Bold text');
        paragraph.children.push(strong);
        strong.children.push(boldText);
        strong.parent = paragraph;
        boldText.parent = strong;

        const formattedParagraph = applyFormattingToParagraph(paragraph, 'italic');

        expect(formattedParagraph.children).toHaveLength(1);
        expect((formattedParagraph.children[0] as ElementNode).tagName).toBe('em');
        expect((formattedParagraph.children[0].children[0] as ElementNode).tagName).toBe('strong');
        expect((formattedParagraph.children[0].children[0].children[0] as TextNode).content).toBe(
          'Bold text',
        );
      });
    });

    describe('removeFormattingFromParagraph', () => {
      test('should remove bold formatting from entire paragraph', () => {
        const paragraph = createElementNode('p');
        const strong = createElementNode('strong');
        const boldText = createTextNode('Bold text');
        paragraph.children.push(strong);
        strong.children.push(boldText);
        strong.parent = paragraph;
        boldText.parent = strong;

        const unformattedParagraph = removeFormattingFromParagraph(paragraph, 'bold');

        expect(unformattedParagraph.children).toHaveLength(1);
        expect(unformattedParagraph.children[0].type).toBe('text');
        expect((unformattedParagraph.children[0] as TextNode).content).toBe('Bold text');
      });

      test('should remove specific formatting while preserving others', () => {
        const paragraph = createElementNode('p');
        const em = createElementNode('em');
        const strong = createElementNode('strong');
        const text = createTextNode('Bold italic text');

        paragraph.children.push(em);
        em.children.push(strong);
        strong.children.push(text);
        em.parent = paragraph;
        strong.parent = em;
        text.parent = strong;

        const unformattedParagraph = removeFormattingFromParagraph(paragraph, 'bold');

        expect(unformattedParagraph.children).toHaveLength(1);
        expect((unformattedParagraph.children[0] as ElementNode).tagName).toBe('em');
        expect((unformattedParagraph.children[0].children[0] as TextNode).content).toBe(
          'Bold italic text',
        );
      });

      test('should handle paragraph without target formatting', () => {
        const paragraph = createElementNode('p');
        const textNode = createTextNode('Plain text');
        paragraph.children.push(textNode);
        textNode.parent = paragraph;

        const unformattedParagraph = removeFormattingFromParagraph(paragraph, 'bold');

        expect(unformattedParagraph.children).toHaveLength(1);
        expect((unformattedParagraph.children[0] as TextNode).content).toBe('Plain text');
      });

      test('should handle unknown node types gracefully', () => {
        const paragraph = createElementNode('p');

        // Create a mock node that is neither text nor element
        const unknownNode = {
          id: 'unknown-1',
          type: 'unknown',
          parent: paragraph,
          children: [],
          startOffset: 0,
          endOffset: 0,
          depth: 1,
        } as unknown as VNode;

        paragraph.children.push(unknownNode);
        unknownNode.parent = paragraph;

        const unformattedParagraph = removeFormattingFromParagraph(paragraph, 'bold');

        // Should handle unknown node type and include it in result
        expect(unformattedParagraph.children).toHaveLength(1);
        expect(unformattedParagraph.children[0]).toBe(unknownNode);
      });
    });

    describe('applyFormattingToMultipleParagraphs', () => {
      test('should apply formatting to multiple paragraphs', () => {
        const paragraph1 = createElementNode('p');
        const paragraph2 = createElementNode('p');
        const text1 = createTextNode('First paragraph');
        const text2 = createTextNode('Second paragraph');

        paragraph1.children.push(text1);
        paragraph2.children.push(text2);
        text1.parent = paragraph1;
        text2.parent = paragraph2;

        const formattedParagraphs = applyFormattingToMultipleParagraphs(
          [paragraph1, paragraph2],
          'bold',
        );

        expect(formattedParagraphs).toHaveLength(2);
        expect((formattedParagraphs[0].children[0] as ElementNode).tagName).toBe('strong');
        expect((formattedParagraphs[1].children[0] as ElementNode).tagName).toBe('strong');
        expect((formattedParagraphs[0].children[0].children[0] as TextNode).content).toBe(
          'First paragraph',
        );
        expect((formattedParagraphs[1].children[0].children[0] as TextNode).content).toBe(
          'Second paragraph',
        );
      });

      test('should handle empty paragraphs array', () => {
        const formattedParagraphs = applyFormattingToMultipleParagraphs([], 'italic');
        expect(formattedParagraphs).toHaveLength(0);
      });

      test('should handle mixed content across paragraphs', () => {
        const paragraph1 = createElementNode('p');
        const paragraph2 = createElementNode('p');
        const text1 = createTextNode('Plain text');
        const strong = createElementNode('strong');
        const boldText = createTextNode('Bold text');

        paragraph1.children.push(text1);
        paragraph2.children.push(strong);
        strong.children.push(boldText);
        text1.parent = paragraph1;
        strong.parent = paragraph2;
        boldText.parent = strong;

        const formattedParagraphs = applyFormattingToMultipleParagraphs(
          [paragraph1, paragraph2],
          'underline',
        );

        expect(formattedParagraphs).toHaveLength(2);
        expect((formattedParagraphs[0].children[0] as ElementNode).tagName).toBe('u');
        expect((formattedParagraphs[1].children[0] as ElementNode).tagName).toBe('u');
        expect((formattedParagraphs[1].children[0].children[0] as ElementNode).tagName).toBe(
          'strong',
        );
      });
    });
  });
});
