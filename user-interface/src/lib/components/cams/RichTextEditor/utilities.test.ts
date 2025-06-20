import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { MockSelectionService } from './SelectionService.humble';
import { DOMPURIFY_CONFIG } from './editor.constants';
import DOMPurify from 'dompurify';
import editorUtilities from './utilities';

function safelySetInnerHTML(element: HTMLElement, html: string): void {
  element.innerHTML = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
}

function setCursorInParagraph(
  paragraph: HTMLParagraphElement,
  offset: number,
  selectionService: MockSelectionService,
): void {
  const textNode = paragraph.firstChild;
  if (textNode) {
    const range = selectionService.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    selectionService.setSelectionRange(range);
  }
}

describe('utilities', () => {
  let container: HTMLDivElement;
  let selectionService: MockSelectionService;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    selectionService = new MockSelectionService();
  });

  afterEach(() => {
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  describe('isEditorInRange', () => {
    test('isEditorInRange returns true when selection is within editor', () => {
      safelySetInnerHTML(container, '<p>Some content</p>');
      setCursorInParagraph(container.querySelector('p')!, 5, selectionService);

      const result = editorUtilities.isEditorInRange(container, selectionService);
      expect(result).toBe(true);
    });

    test('isEditorInRange returns false when no selection exists', () => {
      // Mock no selection by removing all ranges
      const mockSelection = selectionService.getCurrentSelection();
      mockSelection.removeAllRanges();

      const result = editorUtilities.isEditorInRange(container, selectionService);
      expect(result).toBe(false);
    });
  });

  describe('stripFormatting', () => {
    test('handles non-HTMLElement nodes correctly', () => {
      // Create a text node
      const textNode = document.createTextNode('Test text');

      // Call stripFormatting on the text node
      editorUtilities.stripFormatting(textNode);

      // Verify the text node is unchanged
      expect(textNode.textContent).toBe('Test text');
    });

    test('removes formatting elements with children', () => {
      // Create a paragraph with nested formatting
      const paragraph = document.createElement('p');
      safelySetInnerHTML(
        paragraph,
        'Text with <strong>bold <em>and italic</em></strong> formatting',
      );

      // Call stripFormatting on the paragraph
      editorUtilities.stripFormatting(paragraph);

      // Verify all formatting has been removed but text content preserved
      expect(paragraph.innerHTML).not.toContain('<strong>');
      expect(paragraph.innerHTML).not.toContain('<em>');
      expect(paragraph.textContent).toBe('Text with bold and italic formatting');
    });

    test('removes multiple levels of nested formatting', () => {
      // Create a paragraph with deeply nested formatting
      const paragraph = document.createElement('p');
      paragraph.innerHTML =
        '<strong><em><span class="underline">Deeply</span> nested</em> formatting</strong>';

      // Call stripFormatting on the paragraph
      editorUtilities.stripFormatting(paragraph);

      // Verify all formatting has been removed but text content preserved
      expect(paragraph.innerHTML).not.toContain('<strong>');
      expect(paragraph.innerHTML).not.toContain('<em>');
      expect(paragraph.innerHTML).not.toContain('<span');
      expect(paragraph.textContent).toBe('Deeply nested formatting');
    });

    test('handles empty formatting elements', () => {
      // Create a paragraph with empty formatting elements
      const paragraph = document.createElement('p');
      safelySetInnerHTML(
        paragraph,
        'Text with <strong></strong> empty <em></em> formatting elements',
      );

      // Call stripFormatting on the paragraph
      editorUtilities.stripFormatting(paragraph);

      // Verify all formatting has been removed but text content preserved
      expect(paragraph.innerHTML).not.toContain('<strong>');
      expect(paragraph.innerHTML).not.toContain('<em>');
      expect(paragraph.textContent).toBe('Text with  empty  formatting elements');
    });
  });
});
