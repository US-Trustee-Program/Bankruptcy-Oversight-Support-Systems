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
import { createElementNode, createTextNode, createRootNode } from '../virtual-dom/VNodeFactory';
import { ElementNode, TextNode } from '../virtual-dom/VNode';
import { HtmlCodec } from '../virtual-dom/HtmlCodec';

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
  });

  describe('isParagraphNode', () => {
    test('should return true for paragraph element nodes', () => {
      const paragraph = createElementNode('p');
      expect(isParagraphNode(paragraph)).toBe(true);
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
  });

  describe('findParagraphBoundaries', () => {
    test('should find start and end positions of paragraph content', () => {
      const paragraph = createElementNode('p', { startOffset: 10, endOffset: 25 });
      const boundaries = findParagraphBoundaries(paragraph);
      expect(boundaries.start).toBe(10);
      expect(boundaries.end).toBe(25);
    });
  });

  describe('getParagraphContent', () => {
    test('should extract text content from paragraph', () => {
      const paragraph = createParagraphNode({}, 'Hello world');
      const content = getParagraphContent(paragraph);
      expect(content).toBe('Hello world');
    });
  });

  describe('splitParagraphAtCursor', () => {
    test('should split paragraph at cursor position', () => {
      const paragraph = createParagraphNode({}, 'Hello world');
      const result = splitParagraphAtCursor(paragraph, 5);
      expect((result.firstParagraph.children[0] as TextNode).content).toBe('Hello');
      expect((result.secondParagraph.children[0] as TextNode).content).toBe(' world');
    });

    test('should work with HtmlCodec parsed content', () => {
      const initialHtml = '<p><strong>Hello world</strong></p>';
      const root = HtmlCodec.decode(initialHtml);
      const paragraph = root.children[0] as ElementNode;

      const result = splitParagraphAtCursor(paragraph, 5);
      const firstHtml = HtmlCodec.encode(result.firstParagraph);
      const secondHtml = HtmlCodec.encode(result.secondParagraph);

      expect(firstHtml).toContain('Hello');
      const firstDiv = document.createElement('div');
      firstDiv.innerHTML = firstHtml;
      expect(firstDiv.querySelector('strong, b')).not.toBeNull();

      expect(secondHtml).toContain(' world');
      const secondDiv = document.createElement('div');
      secondDiv.innerHTML = secondHtml;
      expect(secondDiv.querySelector('strong, b')).not.toBeNull();
    });
  });

  describe('mergeParagraphs', () => {
    test('should merge two paragraphs into one', () => {
      const paragraph1 = createParagraphNode({}, 'First paragraph');
      const paragraph2 = createParagraphNode({}, 'Second paragraph');
      const mergedParagraph = mergeParagraphs(paragraph1, paragraph2);
      const mergedHtml = HtmlCodec.encode(mergedParagraph);
      expect(mergedHtml).toContain('First paragraphSecond paragraph');
    });
  });

  describe('insertParagraphAfter', () => {
    test('should insert a new paragraph after an existing one', () => {
      const root = createRootNode();
      const p1 = createParagraphNode({}, 'Paragraph 1');
      root.children.push(p1);
      p1.parent = root;
      insertParagraphAfter(p1, 'New paragraph');
      expect(root.children).toHaveLength(2);
      const newParagraphHtml = HtmlCodec.encode(root.children[1]);
      expect(newParagraphHtml).toContain('New paragraph');
    });
  });

  describe('cursor position helpers', () => {
    const paragraph = createParagraphNode({}, 'Hello');
    paragraph.startOffset = 10;
    paragraph.endOffset = 15;

    test('moveCursorToParagraphStart', () => {
      expect(moveCursorToParagraphStart(paragraph)).toBe(10);
    });
    test('moveCursorToParagraphEnd', () => {
      expect(moveCursorToParagraphEnd(paragraph)).toBe(15);
    });
    test('getCursorPositionInParagraph', () => {
      expect(getCursorPositionInParagraph(paragraph, 12)).toBe(2);
    });
    test('setCursorPositionInParagraph', () => {
      expect(setCursorPositionInParagraph(paragraph, 3)).toBe(13);
    });
  });

  describe('findParagraphAtCursor', () => {
    const root = createRootNode();
    const p1 = createParagraphNode({}, 'p1');
    p1.startOffset = 0;
    p1.endOffset = 2;
    const p2 = createParagraphNode({}, 'p2');
    p2.startOffset = 2;
    p2.endOffset = 4;
    root.children.push(p1, p2);
    p1.parent = root;
    p2.parent = root;

    test('should find the correct paragraph', () => {
      expect(findParagraphAtCursor(root, 1)).toBe(p1);
      expect(findParagraphAtCursor(root, 3)).toBe(p2);
    });
  });

  describe('preserveCursorPositionDuringUpdate', () => {
    test('should preserve relative cursor position', () => {
      const p1 = createParagraphNode({}, 'p1');
      p1.startOffset = 0;
      const p2 = createParagraphNode({}, 'p2');
      p2.startOffset = 10;
      expect(preserveCursorPositionDuringUpdate(p1, p2, 1)).toBe(11);
    });
  });

  describe('formatting', () => {
    const paragraph = createParagraphNode({}, 'Hello');

    test('applyFormattingToParagraph', () => {
      const formatted = applyFormattingToParagraph(paragraph, 'bold');
      const encoded = HtmlCodec.encode(formatted);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = encoded;
      expect(tempDiv.textContent).toContain('Hello');
      expect(tempDiv.querySelector('strong, b')).not.toBeNull();
    });

    test('removeFormattingFromParagraph', () => {
      const formatted = applyFormattingToParagraph(paragraph, 'bold');
      const unformatted = removeFormattingFromParagraph(formatted, 'bold');
      expect(HtmlCodec.encode(unformatted)).not.toContain('<strong>');
    });

    test('applyFormattingToMultipleParagraphs', () => {
      const p1 = createParagraphNode({}, 'P1');
      const p2 = createParagraphNode({}, 'P2');
      const formatted = applyFormattingToMultipleParagraphs([p1, p2], 'bold');
      const encoded1 = HtmlCodec.encode(formatted[0]);
      const encoded2 = HtmlCodec.encode(formatted[1]);

      const div1 = document.createElement('div');
      div1.innerHTML = encoded1;
      expect(div1.textContent).toContain('P1');
      expect(div1.querySelector('strong, b')).not.toBeNull();

      const div2 = document.createElement('div');
      div2.innerHTML = encoded2;
      expect(div2.textContent).toContain('P2');
      expect(div2.querySelector('strong, b')).not.toBeNull();
    });
  });
});
