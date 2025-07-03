import { describe, test, expect, vi, beforeEach } from 'vitest';
import { BrowserSelectionService, MockSelectionService } from './SelectionService.humble';

describe('SelectionService.humble', () => {
  describe('BrowserSelectionService', () => {
    let mockWindow: Partial<Window>;
    let mockDocument: Partial<Document>;
    let mockSelection: Partial<Selection>;
    let service: BrowserSelectionService;

    beforeEach(() => {
      vi.restoreAllMocks();

      // Setup mocks for window and document
      mockSelection = {
        toString: vi.fn().mockReturnValue('selected text'),
        isCollapsed: false,
        anchorNode: {} as Node,
        anchorOffset: 3,
        focusNode: {} as Node,
        focusOffset: 8,
      };

      mockWindow = {
        getSelection: vi.fn().mockReturnValue(mockSelection),
      };

      mockDocument = {
        createRange: vi.fn().mockReturnValue({} as Range),
      };

      service = new BrowserSelectionService(mockWindow as Window, mockDocument as Document);
    });

    test('should implement getSelectionText() method', () => {
      const result = service.getSelectionText();
      expect(mockWindow.getSelection).toHaveBeenCalled();
      expect(result).toBe('selected text');
    });

    test('should implement isSelectionCollapsed() method', () => {
      mockSelection.isCollapsed = true;
      expect(service.isSelectionCollapsed()).toBe(true);

      mockSelection.isCollapsed = false;
      expect(service.isSelectionCollapsed()).toBe(false);
    });

    test('should implement getSelectionAnchorNode() method', () => {
      const anchorNode = {} as Node;
      mockSelection.anchorNode = anchorNode;

      expect(service.getSelectionAnchorNode()).toBe(anchorNode);
    });

    test('should implement getSelectionAnchorOffset() method', () => {
      mockSelection.anchorOffset = 5;

      expect(service.getSelectionAnchorOffset()).toBe(5);
    });

    test('should implement getSelectionFocusNode() method', () => {
      const focusNode = {} as Node;
      mockSelection.focusNode = focusNode;

      expect(service.getSelectionFocusNode()).toBe(focusNode);
    });

    test('should implement getSelectionFocusOffset() method', () => {
      mockSelection.focusOffset = 10;

      expect(service.getSelectionFocusOffset()).toBe(10);
    });

    test('should handle null selection in all methods', () => {
      mockWindow.getSelection = vi.fn().mockReturnValue(null);

      expect(service.getSelectionText()).toBe('');
      expect(service.isSelectionCollapsed()).toBe(true); // Default when no selection
      expect(service.getSelectionAnchorNode()).toBeNull();
      expect(service.getSelectionAnchorOffset()).toBe(0);
      expect(service.getSelectionFocusNode()).toBeNull();
      expect(service.getSelectionFocusOffset()).toBe(0);
    });
  });

  describe('MockSelectionService', () => {
    let service: MockSelectionService;
    let mockAnchorNode: Node;
    let mockFocusNode: Node;

    beforeEach(() => {
      vi.restoreAllMocks();
      service = new MockSelectionService();
      mockAnchorNode = document.createTextNode('anchor');
      mockFocusNode = document.createTextNode('focus');
    });

    test('should implement getSelectionText() method', () => {
      service.setMockSelectedText('mock selected text');
      expect(service.getSelectionText()).toBe('mock selected text');
    });

    test('should implement isSelectionCollapsed() method', () => {
      // Default should be collapsed
      expect(service.isSelectionCollapsed()).toBe(true);

      // Set up a non-collapsed selection
      const mockRange = document.createRange();
      service.setSelectionRange(mockRange);
      service.setIsCollapsed(false);

      expect(service.isSelectionCollapsed()).toBe(false);
    });

    test('should implement selection node and offset methods', () => {
      // Set up mock nodes and offsets
      service.setMockAnchorNode(mockAnchorNode, 3);
      service.setMockFocusNode(mockFocusNode, 7);

      expect(service.getSelectionAnchorNode()).toBe(mockAnchorNode);
      expect(service.getSelectionAnchorOffset()).toBe(3);
      expect(service.getSelectionFocusNode()).toBe(mockFocusNode);
      expect(service.getSelectionFocusOffset()).toBe(7);
    });
  });
});
