import { beforeEach, describe, test, expect, vi } from 'vitest';
import {
  cleanHtml,
  safelyGetHtml,
  safelySetHtml,
  isEmptyContent,
  isElementEmpty,
  normalizeHtml,
  extractTextFromHtml,
  isOnlyZeroWidthSpaces,
  editorUtilities,
} from './Editor.utilities';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html: string) => {
      // Simple mock that removes script tags and dangerous attributes
      return html
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/javascript:/gi, '');
    }),
  },
}));

describe('Editor.utilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset DOM
    document.body.innerHTML = '';
  });

  describe('cleanHtml', () => {
    test('should return empty string for null or undefined input', () => {
      expect(cleanHtml('')).toBe('');
      expect(cleanHtml(null as never)).toBe('');
      expect(cleanHtml(undefined as never)).toBe('');
    });

    test('should return empty string for non-string input', () => {
      expect(cleanHtml(123 as never)).toBe('');
      expect(cleanHtml({} as never)).toBe('');
      expect(cleanHtml([] as never)).toBe('');
    });

    test('should sanitize HTML content', () => {
      const dirtyHtml = '<p>Hello <script>alert("xss")</script>World</p>';
      const result = cleanHtml(dirtyHtml);
      expect(result).toBe('<p>Hello World</p>');
    });

    test('should remove empty tags', () => {
      const htmlWithEmptyTags = '<p>Hello</p><p></p><p>World</p>';
      const result = cleanHtml(htmlWithEmptyTags);
      expect(result).toBe('<p>Hello</p><p>World</p>');
    });

    test('should preserve valid HTML', () => {
      const validHtml = '<p><strong>Bold</strong> and <em>italic</em> text</p>';
      const result = cleanHtml(validHtml);
      expect(result).toBe(validHtml);
    });
  });

  describe('safelyGetHtml', () => {
    test('should return empty string for null or undefined element', () => {
      expect(safelyGetHtml(null)).toBe('');
      expect(safelyGetHtml(undefined)).toBe('');
    });

    test('should return innerHTML of valid element', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Test content</p>';
      expect(safelyGetHtml(div)).toBe('<p>Test content</p>');
    });

    test('should return empty string for element with no innerHTML', () => {
      const div = document.createElement('div');
      expect(safelyGetHtml(div)).toBe('');
    });

    test('should handle errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockElement = {
        get innerHTML() {
          throw new Error('Test error');
        },
      } as unknown as HTMLElement;

      const result = safelyGetHtml(mockElement);
      expect(result).toBe('');
      expect(consoleSpy).toHaveBeenCalledWith('Error getting HTML content:', expect.any(Error));
    });
  });

  describe('safelySetHtml', () => {
    test('should do nothing for null or undefined element', () => {
      expect(() => safelySetHtml(null, '<p>Test</p>')).not.toThrow();
      expect(() => safelySetHtml(undefined, '<p>Test</p>')).not.toThrow();
    });

    test('should set innerHTML of valid element', () => {
      const div = document.createElement('div');
      safelySetHtml(div, '<p>Test content</p>');
      expect(div.innerHTML).toBe('<p>Test content</p>');
    });

    test('should clean HTML before setting', () => {
      const div = document.createElement('div');
      const dirtyHtml = '<p>Hello <script>alert("xss")</script>World</p>';
      safelySetHtml(div, dirtyHtml);
      expect(div.innerHTML).toBe('<p>Hello World</p>');
    });

    test('should handle errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockElement = {
        set innerHTML(_: string) {
          throw new Error('Test error');
        },
      } as unknown as HTMLElement;

      expect(() => safelySetHtml(mockElement, '<p>Test</p>')).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Error setting HTML content:', expect.any(Error));
    });
  });

  describe('isEmptyContent', () => {
    test('should return true for null, undefined, or empty string', () => {
      expect(isEmptyContent('')).toBe(true);
      expect(isEmptyContent(null as never)).toBe(true);
      expect(isEmptyContent(undefined as never)).toBe(true);
    });

    test('should return true for non-string input', () => {
      expect(isEmptyContent(123 as never)).toBe(true);
      expect(isEmptyContent({} as never)).toBe(true);
    });

    test('should return true for whitespace-only content', () => {
      expect(isEmptyContent('   ')).toBe(true);
      expect(isEmptyContent('\n\t  ')).toBe(true);
    });

    test('should return true for zero-width spaces only', () => {
      expect(isEmptyContent(ZERO_WIDTH_SPACE)).toBe(true);
      expect(isEmptyContent(ZERO_WIDTH_SPACE + ZERO_WIDTH_SPACE)).toBe(true);
    });

    test('should return true for empty HTML tags', () => {
      expect(isEmptyContent('<p></p>')).toBe(true);
      expect(isEmptyContent('<p>   </p>')).toBe(true);
      expect(isEmptyContent(`<p>${ZERO_WIDTH_SPACE}</p>`)).toBe(true);
    });

    test('should return false for content with text', () => {
      expect(isEmptyContent('Hello')).toBe(false);
      expect(isEmptyContent('<p>Hello</p>')).toBe(false);
      expect(isEmptyContent('  Hello  ')).toBe(false);
    });
  });

  describe('isElementEmpty', () => {
    test('should return true for null or undefined element', () => {
      expect(isElementEmpty(null)).toBe(true);
      expect(isElementEmpty(undefined)).toBe(true);
    });

    test('should return true for element with empty content', () => {
      const div = document.createElement('div');
      expect(isElementEmpty(div)).toBe(true);

      div.innerHTML = '<p></p>';
      expect(isElementEmpty(div)).toBe(true);
    });

    test('should return false for element with content', () => {
      const div = document.createElement('div');
      div.innerHTML = '<p>Hello</p>';
      expect(isElementEmpty(div)).toBe(false);
    });
  });

  describe('normalizeHtml', () => {
    test('should return paragraph with zero-width space for empty content', () => {
      expect(normalizeHtml('')).toBe(`<p>${ZERO_WIDTH_SPACE}</p>`);
      expect(normalizeHtml('   ')).toBe(`<p>${ZERO_WIDTH_SPACE}</p>`);
      expect(normalizeHtml('<p></p>')).toBe(`<p>${ZERO_WIDTH_SPACE}</p>`);
    });

    test('should wrap non-block content in paragraph', () => {
      expect(normalizeHtml('Hello world')).toBe('<p>Hello world</p>');
      expect(normalizeHtml('<strong>Bold</strong> text')).toBe('<p><strong>Bold</strong> text</p>');
    });

    test('should preserve existing block elements', () => {
      expect(normalizeHtml('<p>Hello</p>')).toBe('<p>Hello</p>');
      expect(normalizeHtml('<div>Hello</div>')).toBe('<div>Hello</div>');
      expect(normalizeHtml('<ul><li>Item</li></ul>')).toBe('<ul><li>Item</li></ul>');
    });

    test('should clean HTML during normalization', () => {
      const dirtyHtml = '<p>Hello <script>alert("xss")</script>World</p>';
      const result = normalizeHtml(dirtyHtml);
      expect(result).toBe('<p>Hello World</p>');
    });
  });

  describe('extractTextFromHtml', () => {
    test('should return empty string for null, undefined, or empty input', () => {
      expect(extractTextFromHtml('')).toBe('');
      expect(extractTextFromHtml(null as never)).toBe('');
      expect(extractTextFromHtml(undefined as never)).toBe('');
    });

    test('should extract text from HTML', () => {
      expect(extractTextFromHtml('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
      expect(extractTextFromHtml('<div><p>Line 1</p><p>Line 2</p></div>')).toBe('Line 1Line 2');
    });

    test('should remove zero-width spaces from extracted text', () => {
      const htmlWithZws = `<p>Hello${ZERO_WIDTH_SPACE}world</p>`;
      expect(extractTextFromHtml(htmlWithZws)).toBe('Helloworld');
    });

    test('should clean HTML before extracting text', () => {
      const dirtyHtml = '<p>Hello <script>alert("xss")</script>World</p>';
      expect(extractTextFromHtml(dirtyHtml)).toBe('Hello World');
    });
  });

  describe('isOnlyZeroWidthSpaces', () => {
    test('should return false for null, undefined, or empty string', () => {
      expect(isOnlyZeroWidthSpaces('')).toBe(false);
      expect(isOnlyZeroWidthSpaces(null as never)).toBe(false);
      expect(isOnlyZeroWidthSpaces(undefined as never)).toBe(false);
    });

    test('should return false for non-string input', () => {
      expect(isOnlyZeroWidthSpaces(123 as never)).toBe(false);
      expect(isOnlyZeroWidthSpaces({} as never)).toBe(false);
    });

    test('should return true for strings containing only zero-width spaces', () => {
      expect(isOnlyZeroWidthSpaces(ZERO_WIDTH_SPACE)).toBe(true);
      expect(isOnlyZeroWidthSpaces(ZERO_WIDTH_SPACE + ZERO_WIDTH_SPACE)).toBe(true);
    });

    test('should return false for strings with other content', () => {
      expect(isOnlyZeroWidthSpaces('Hello')).toBe(false);
      expect(isOnlyZeroWidthSpaces(ZERO_WIDTH_SPACE + 'Hello')).toBe(false);
      expect(isOnlyZeroWidthSpaces('   ')).toBe(false);
    });
  });

  describe('editorUtilities object', () => {
    test('should export all utility functions', () => {
      expect(editorUtilities.cleanHtml).toBe(cleanHtml);
      expect(editorUtilities.safelyGetHtml).toBe(safelyGetHtml);
      expect(editorUtilities.safelySetHtml).toBe(safelySetHtml);
      expect(editorUtilities.isEmptyContent).toBe(isEmptyContent);
      expect(editorUtilities.isElementEmpty).toBe(isElementEmpty);
      expect(editorUtilities.normalizeHtml).toBe(normalizeHtml);
      expect(editorUtilities.extractTextFromHtml).toBe(extractTextFromHtml);
      expect(editorUtilities.isOnlyZeroWidthSpaces).toBe(isOnlyZeroWidthSpaces);
    });
  });
});
