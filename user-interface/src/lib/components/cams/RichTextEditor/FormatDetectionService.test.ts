/* eslint-disable prettier/prettier */
import { FormatDetectionService } from './FormatDetectionService';
import { SelectionService } from './SelectionService.humble';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type MockFunction = ReturnType<typeof vi.fn>;

describe('FormatDetectionService', () => {
  let root: HTMLElement;
  let mockSelectionService: SelectionService;
  let formatDetectionService: FormatDetectionService;

  beforeEach(() => {
    // Set up the DOM and mocks
    document.body.innerHTML = '<div id="editor"></div>';
    root = document.getElementById('editor') as HTMLElement;

    mockSelectionService = {
      getCurrentSelection: vi.fn(),
      createElement: vi.fn().mockImplementation((tag) => document.createElement(tag)),
      createTextNode: vi.fn().mockImplementation((text) => document.createTextNode(text)),
    } as unknown as SelectionService;

    // Create the service
    formatDetectionService = new FormatDetectionService(root, mockSelectionService);
  });

  afterEach(() => {
    vi.resetAllMocks();
    document.body.innerHTML = '';
  });

  describe('getFormatState', () => {
    it('should return all formats as false when no selection exists', () => {
      // Arrange
      (mockSelectionService.getCurrentSelection as unknown as MockFunction).mockReturnValue(null);

      // Act
      const result = formatDetectionService.getFormatState();

      // Assert
      expect(result).toEqual({
        bold: false,
        italic: false,
        underline: false,
        orderedList: false,
        unorderedList: false,
      });
    });

    it('should return all formats as false when selection has no ranges', () => {
      // Arrange
      const mockSelection = {
        rangeCount: 0,
      } as unknown as Selection;

      (mockSelectionService.getCurrentSelection as unknown as MockFunction).mockReturnValue(mockSelection);

      // Act
      const result = formatDetectionService.getFormatState();

      // Assert
      expect(result).toEqual({
        bold: false,
        italic: false,
        underline: false,
        orderedList: false,
        unorderedList: false,
      });
    });

    it('should detect bold formatting at cursor position', () => {
      // Arrange
      // Create a strong element with text inside
      const strongElement = document.createElement('strong');
      const textNode = document.createTextNode('Bold text');
      strongElement.appendChild(textNode);
      root.appendChild(strongElement);

      // Mock the range and selection
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue({
          collapsed: true,
          startContainer: textNode,
          endContainer: textNode,
          startOffset: 0,
          endOffset: 0,
        } as unknown as Range),
      } as unknown as Selection;

      (mockSelectionService.getCurrentSelection as unknown as MockFunction).mockReturnValue(mockSelection);

      // Act
      const result = formatDetectionService.getFormatState();

      // Assert
      expect(result.bold).toBe(true);
      expect(result.italic).toBe(false);
      expect(result.underline).toBe(false);
      expect(result.orderedList).toBe(false);
      expect(result.unorderedList).toBe(false);
    });

    it('should not detect bold formatting when cursor is not inside a bold element', () => {
      // Arrange
      // Create a regular paragraph with text
      const paragraph = document.createElement('p');
      const textNode = document.createTextNode('Regular text');
      paragraph.appendChild(textNode);
      root.appendChild(paragraph);

      // Mock the range and selection
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue({
          collapsed: true,
          startContainer: textNode,
          endContainer: textNode,
          startOffset: 0,
          endOffset: 0,
        } as unknown as Range),
      } as unknown as Selection;

      (mockSelectionService.getCurrentSelection as unknown as MockFunction).mockReturnValue(mockSelection);

      // Act
      const result = formatDetectionService.getFormatState();

      // Assert
      expect(result.bold).toBe(false);
      expect(result.italic).toBe(false);
      expect(result.underline).toBe(false);
      expect(result.orderedList).toBe(false);
      expect(result.unorderedList).toBe(false);
    });

    it('should detect bold formatting when cursor is inside a nested bold element', () => {
      // Arrange
      // Create a nested structure: p > strong > text
      const paragraph = document.createElement('p');
      const strongElement = document.createElement('strong');
      const textNode = document.createTextNode('Nested bold text');

      strongElement.appendChild(textNode);
      paragraph.appendChild(strongElement);
      root.appendChild(paragraph);

      // Mock the range and selection
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue({
          collapsed: true,
          startContainer: textNode,
          endContainer: textNode,
          startOffset: 0,
          endOffset: 0,
        } as unknown as Range),
      } as unknown as Selection;

      (mockSelectionService.getCurrentSelection as unknown as MockFunction).mockReturnValue(mockSelection);

      // Act
      const result = formatDetectionService.getFormatState();

      // Assert
      expect(result.bold).toBe(true);
      expect(result.italic).toBe(false);
      expect(result.underline).toBe(false);
      expect(result.orderedList).toBe(false);
      expect(result.unorderedList).toBe(false);
    });

    it('should detect bold formatting when text is selected within a bold element', () => {
      // Arrange
      // Create a strong element with text inside
      const strongElement = document.createElement('strong');
      const textNode = document.createTextNode('Bold text');
      strongElement.appendChild(textNode);
      root.appendChild(strongElement);

      // Mock the range and selection - note collapsed: false for text selection
      const mockSelection = {
        rangeCount: 1,
        getRangeAt: vi.fn().mockReturnValue({
          collapsed: false,
          startContainer: textNode,
          endContainer: textNode,
          startOffset: 0,
          endOffset: 9, // Select the entire "Bold text"
        } as unknown as Range),
      } as unknown as Selection;

      (mockSelectionService.getCurrentSelection as unknown as MockFunction).mockReturnValue(mockSelection);

      // Act
      const result = formatDetectionService.getFormatState();

      // Assert
      expect(result.bold).toBe(true);
      expect(result.italic).toBe(false);
      expect(result.underline).toBe(false);
      expect(result.orderedList).toBe(false);
      expect(result.unorderedList).toBe(false);
    });
  });
});
