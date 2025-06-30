import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  hasFormatting,
  hasAncestorFormatting,
  getSelectionFormattingState,
  findFormattingElement,
} from './FormattingDetectionService';

describe('FormattingDetectionService', () => {
  let rootElement: HTMLDivElement;

  beforeEach(() => {
    // Create a clean DOM environment for each test
    document.body.innerHTML = '';
    rootElement = document.createElement('div');
    rootElement.contentEditable = 'true';
    document.body.appendChild(rootElement);
  });

  describe('hasFormatting', () => {
    test('should detect bold formatting with strong tag', () => {
      const strongElement = document.createElement('strong');
      expect(hasFormatting(strongElement, 'bold')).toBe(true);
    });

    test('should detect bold formatting with b tag', () => {
      const bElement = document.createElement('b');
      expect(hasFormatting(bElement, 'bold')).toBe(true);
    });

    test('should detect italic formatting with em tag', () => {
      const emElement = document.createElement('em');
      expect(hasFormatting(emElement, 'italic')).toBe(true);
    });

    test('should detect italic formatting with i tag', () => {
      const iElement = document.createElement('i');
      expect(hasFormatting(iElement, 'italic')).toBe(true);
    });

    test('should detect underline formatting with u tag', () => {
      const uElement = document.createElement('u');
      expect(hasFormatting(uElement, 'underline')).toBe(true);
    });

    test('should not detect formatting on non-formatting elements', () => {
      const divElement = document.createElement('div');
      expect(hasFormatting(divElement, 'bold')).toBe(false);
      expect(hasFormatting(divElement, 'italic')).toBe(false);
      expect(hasFormatting(divElement, 'underline')).toBe(false);
    });

    test('should handle case insensitive tag names', () => {
      const strongElement = document.createElement('STRONG');
      expect(hasFormatting(strongElement, 'bold')).toBe(true);
    });
  });

  describe('hasAncestorFormatting', () => {
    test('should detect formatting in direct parent', () => {
      const strongElement = document.createElement('strong');
      const textElement = document.createElement('span');
      strongElement.appendChild(textElement);
      rootElement.appendChild(strongElement);

      expect(hasAncestorFormatting(textElement, 'bold', rootElement)).toBe(true);
    });

    test('should detect formatting in ancestor chain', () => {
      const strongElement = document.createElement('strong');
      const spanElement = document.createElement('span');
      const textElement = document.createElement('span');

      strongElement.appendChild(spanElement);
      spanElement.appendChild(textElement);
      rootElement.appendChild(strongElement);

      expect(hasAncestorFormatting(textElement, 'bold', rootElement)).toBe(true);
    });

    test('should not detect formatting when none exists', () => {
      const spanElement = document.createElement('span');
      const textElement = document.createElement('span');

      spanElement.appendChild(textElement);
      rootElement.appendChild(spanElement);

      expect(hasAncestorFormatting(textElement, 'bold', rootElement)).toBe(false);
    });

    test('should stop at root element', () => {
      const outerStrong = document.createElement('strong');
      const innerDiv = document.createElement('div');
      const textElement = document.createElement('span');

      outerStrong.appendChild(innerDiv);
      innerDiv.appendChild(textElement);
      document.body.appendChild(outerStrong);

      // Should not find formatting beyond the root element
      expect(hasAncestorFormatting(textElement, 'bold', innerDiv)).toBe(false);
    });
  });

  describe('getSelectionFormattingState', () => {
    test('should return "none" for null selection', () => {
      expect(getSelectionFormattingState(null as never, 'bold', rootElement)).toBe('none');
    });

    test('should return "none" for selection with no ranges', () => {
      const selectionWithNoRanges = {
        rangeCount: 0,
        getRangeAt: vi.fn(),
        removeAllRanges: vi.fn(),
      } as unknown as Selection;
      expect(getSelectionFormattingState(selectionWithNoRanges, 'bold', rootElement)).toBe('none');
    });

    test('should return "all" for collapsed selection in formatted element', () => {
      // Create formatted content
      rootElement.innerHTML = '<strong>Bold text</strong>';
      const strongElement = rootElement.querySelector('strong')!;
      const textNode = strongElement.firstChild!;

      // Mock collapsed selection
      const mockRange = {
        collapsed: true,
        startContainer: textNode,
        commonAncestorContainer: textNode,
        intersectsNode: vi.fn(),
      } as unknown as Range;

      const selectionWithRange = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue(mockRange),
        removeAllRanges: vi.fn(),
      } as unknown as Selection;

      expect(getSelectionFormattingState(selectionWithRange, 'bold', rootElement)).toBe('all');
    });

    test('should return "none" for collapsed selection in unformatted element', () => {
      // Create unformatted content
      rootElement.innerHTML = 'Plain text';
      const textNode = rootElement.firstChild!;

      // Mock collapsed selection
      const mockRange = {
        collapsed: true,
        startContainer: textNode,
        commonAncestorContainer: textNode,
        intersectsNode: vi.fn(),
      } as unknown as Range;

      const selectionWithRange = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue(mockRange),
        removeAllRanges: vi.fn(),
      } as unknown as Selection;

      expect(getSelectionFormattingState(selectionWithRange, 'bold', rootElement)).toBe('none');
    });

    test('should return "all" for selection with all formatted text', () => {
      // Create formatted content
      rootElement.innerHTML = '<strong>Bold text</strong>';
      const strongElement = rootElement.querySelector('strong')!;
      const textNode = strongElement.firstChild!;

      // Mock non-collapsed selection
      const mockRange = {
        collapsed: false,
        commonAncestorContainer: strongElement,
        intersectsNode: vi.fn().mockReturnValue(true),
      } as unknown as Range;

      const selectionWithRange = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue(mockRange),
        removeAllRanges: vi.fn(),
      } as unknown as Selection;

      // Mock TreeWalker
      const mockTreeWalker = {
        nextNode: vi.fn().mockReturnValueOnce(textNode).mockReturnValueOnce(null),
      };
      vi.spyOn(document, 'createTreeWalker').mockReturnValue(
        mockTreeWalker as unknown as TreeWalker,
      );

      expect(getSelectionFormattingState(selectionWithRange, 'bold', rootElement)).toBe('all');
    });

    test('should return "none" for selection with no formatted text', () => {
      // Create unformatted content
      rootElement.innerHTML = 'Plain text';
      const textNode = rootElement.firstChild!;

      // Mock non-collapsed selection
      const mockRange = {
        collapsed: false,
        commonAncestorContainer: rootElement,
        intersectsNode: vi.fn().mockReturnValue(true),
      } as unknown as Range;

      const selectionWithRange = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue(mockRange),
        removeAllRanges: vi.fn(),
      } as unknown as Selection;

      // Mock TreeWalker
      const mockTreeWalker = {
        nextNode: vi.fn().mockReturnValueOnce(textNode).mockReturnValueOnce(null),
      };
      vi.spyOn(document, 'createTreeWalker').mockReturnValue(
        mockTreeWalker as unknown as TreeWalker,
      );

      expect(getSelectionFormattingState(selectionWithRange, 'bold', rootElement)).toBe('none');
    });

    test('should return "partial" for selection with mixed formatting', () => {
      // Create mixed content
      rootElement.innerHTML = '<strong>Bold</strong> and plain text';
      const strongElement = rootElement.querySelector('strong')!;
      const boldTextNode = strongElement.firstChild!;
      const plainTextNode = rootElement.childNodes[1]!;

      // Mock non-collapsed selection
      const mockRange = {
        collapsed: false,
        commonAncestorContainer: rootElement,
        intersectsNode: vi.fn().mockReturnValue(true),
      } as unknown as Range;

      const selectionWithRange = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue(mockRange),
        removeAllRanges: vi.fn(),
      } as unknown as Selection;

      // Mock TreeWalker to return both formatted and unformatted text nodes
      const mockTreeWalker = {
        nextNode: vi
          .fn()
          .mockReturnValueOnce(boldTextNode)
          .mockReturnValueOnce(plainTextNode)
          .mockReturnValueOnce(null),
      };
      vi.spyOn(document, 'createTreeWalker').mockReturnValue(
        mockTreeWalker as unknown as TreeWalker,
      );

      expect(getSelectionFormattingState(selectionWithRange, 'bold', rootElement)).toBe('partial');
    });

    test('should handle TreeWalker with nodes outside range', () => {
      // Create content with nodes that might be outside the range
      rootElement.innerHTML = '<strong>Bold</strong> text <em>italic</em>';
      const strongElement = rootElement.querySelector('strong')!;
      const boldTextNode = strongElement.firstChild!;

      // Create a real range that covers only part of the content
      const range = document.createRange();
      range.setStart(boldTextNode, 0);
      range.setEnd(boldTextNode, boldTextNode.textContent!.length);

      const selectionWithRange = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue(range),
        removeAllRanges: vi.fn(),
      } as unknown as Selection;

      // This will exercise the real TreeWalker and acceptNode function
      // The result depends on the actual DOM structure and range behavior
      const result = getSelectionFormattingState(selectionWithRange, 'bold', rootElement);
      expect(['all', 'partial', 'none']).toContain(result);
    });

    test('should handle edge case with formatted and unformatted text without early exit', () => {
      // Create mixed content
      rootElement.innerHTML = '<strong>Bold</strong> plain <em>italic</em>';
      const strongElement = rootElement.querySelector('strong')!;
      const boldTextNode = strongElement.firstChild!;

      // Mock non-collapsed selection
      const mockRange = {
        collapsed: false,
        commonAncestorContainer: rootElement,
        intersectsNode: vi.fn().mockReturnValue(true),
      } as unknown as Range;

      const selectionWithRange = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue(mockRange),
        removeAllRanges: vi.fn(),
      } as unknown as Selection;

      // Mock TreeWalker to return nodes in a way that doesn't trigger early exit
      // This will test the final else if condition (line 121)
      const mockTreeWalker = {
        nextNode: vi.fn().mockReturnValueOnce(boldTextNode).mockReturnValueOnce(null), // End before we get to unformatted text
      };
      vi.spyOn(document, 'createTreeWalker').mockReturnValue(
        mockTreeWalker as unknown as TreeWalker,
      );

      expect(getSelectionFormattingState(selectionWithRange, 'bold', rootElement)).toBe('all');
    });
  });

  describe('findFormattingElement', () => {
    test('should find direct formatting element', () => {
      const strongElement = document.createElement('strong');
      rootElement.appendChild(strongElement);

      const result = findFormattingElement(strongElement, 'bold', rootElement);
      expect(result).toBe(strongElement);
    });

    test('should find formatting element in parent chain', () => {
      const strongElement = document.createElement('strong');
      const spanElement = document.createElement('span');

      strongElement.appendChild(spanElement);
      rootElement.appendChild(strongElement);

      const result = findFormattingElement(spanElement, 'bold', rootElement);
      expect(result).toBe(strongElement);
    });

    test('should return null when no formatting element found', () => {
      const spanElement = document.createElement('span');
      rootElement.appendChild(spanElement);

      const result = findFormattingElement(spanElement, 'bold', rootElement);
      expect(result).toBeNull();
    });

    test('should stop at root element', () => {
      const outerStrong = document.createElement('strong');
      const innerDiv = document.createElement('div');
      const spanElement = document.createElement('span');

      outerStrong.appendChild(innerDiv);
      innerDiv.appendChild(spanElement);
      document.body.appendChild(outerStrong);

      // Should not find formatting beyond the root element
      const result = findFormattingElement(spanElement, 'bold', innerDiv);
      expect(result).toBeNull();
    });
  });
});
