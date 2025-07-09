import { describe, expect, beforeEach, vi } from 'vitest';
import {
  getSelectionFromBrowser,
  applySelectionToBrowser,
  getNodesInRange,
  getFormattingAtSelection,
} from './VDOMSelection';
import { VDOMNode, VDOMSelection, VDOMPosition } from '../types';
import { SelectionService } from '../selection/SelectionService.humble';

// Mock SelectionService for testing
class MockSelectionService implements SelectionService {
  private mockSelection: Selection | null = null;
  private mockRange: Range | null = null;

  constructor() {
    this.mockRange = {
      setStart: vi.fn(),
      setEnd: vi.fn(),
      collapse: vi.fn(),
    } as unknown as Range;
  }

  getCurrentSelection(): Selection | null {
    return this.mockSelection;
  }

  getRangeAtStartOfSelection(): Range | undefined {
    return this.mockRange || undefined;
  }

  createRange(): Range {
    return this.mockRange!;
  }

  setSelectionRange = vi.fn();
  getSelectedText = vi.fn().mockReturnValue('');
  getSelectionText = vi.fn().mockReturnValue('');
  isSelectionCollapsed = vi.fn().mockReturnValue(true);
  getSelectionAnchorNode = vi.fn().mockReturnValue(null);
  getSelectionAnchorOffset = vi.fn().mockReturnValue(0);
  getSelectionFocusNode = vi.fn().mockReturnValue(null);
  getSelectionFocusOffset = vi.fn().mockReturnValue(0);
  selectNodeContents = vi.fn();
  createElement = vi.fn();
  createTextNode = vi.fn();
  createDocumentFragment = vi.fn();
  createTreeWalker = vi.fn();

  // Helper methods for testing
  setMockSelection(selection: Selection | null) {
    this.mockSelection = selection;
  }

  setMockSelectionProperties(props: {
    isCollapsed?: boolean;
    anchorNode?: Node | null;
    anchorOffset?: number;
    focusNode?: Node | null;
    focusOffset?: number;
  }) {
    this.setMockSelection(props as Selection);
  }
}

describe('VDOMSelection', () => {
  let mockSelectionService: MockSelectionService;
  let mockRootElement: HTMLElement;

  // Helper function to create test VDOM nodes
  const createTextNode = (content: string, path: number[]): VDOMNode => ({
    type: 'text',
    path,
    content,
  });

  const createElementNode = (
    type: 'paragraph' | 'strong' | 'em' | 'u',
    path: number[],
    children?: VDOMNode[],
  ): VDOMNode => ({
    type,
    path,
    children: children || [],
  });

  // Helper function to create test positions
  const createPosition = (node: VDOMNode, offset: number): VDOMPosition => ({
    node,
    offset,
  });

  // Helper function to create test selections
  const createSelection = (
    startNode: VDOMNode,
    startOffset: number,
    endNode: VDOMNode,
    endOffset: number,
  ): VDOMSelection => ({
    start: createPosition(startNode, startOffset),
    end: createPosition(endNode, endOffset),
    isCollapsed: startNode === endNode && startOffset === endOffset,
  });

  beforeEach(() => {
    mockSelectionService = new MockSelectionService();
    mockRootElement = document.createElement('div');
    mockRootElement.contentEditable = 'true';
  });

  describe('getSelectionFromBrowser', () => {
    test('should return default selection when no browser selection exists', () => {
      // Arrange
      const vdom: VDOMNode[] = [createTextNode('Hello', [0])];
      mockSelectionService.setMockSelection(null);

      // Act
      const result = getSelectionFromBrowser(mockSelectionService, mockRootElement, vdom);

      // Assert
      expect(result.isCollapsed).toBe(true);
      expect(result.start.offset).toBe(0);
      expect(result.end.offset).toBe(0);
    });

    test('should map collapsed browser selection to VDOM selection', () => {
      // Arrange
      const textNode = createTextNode('Hello world', [0]);
      const vdom: VDOMNode[] = [textNode];

      const mockTextNodeDOM = document.createTextNode('Hello world');
      mockRootElement.appendChild(mockTextNodeDOM);

      mockSelectionService.setMockSelectionProperties({
        isCollapsed: true,
        anchorNode: mockTextNodeDOM,
        anchorOffset: 5,
        focusNode: mockTextNodeDOM,
        focusOffset: 5,
      });

      // Act
      const result = getSelectionFromBrowser(mockSelectionService, mockRootElement, vdom);

      // Assert
      expect(result.isCollapsed).toBe(true);
      expect(result.start.node).toBe(textNode);
      expect(result.start.offset).toBe(5);
      expect(result.end.node).toBe(textNode);
      expect(result.end.offset).toBe(5);
    });

    test('should map range browser selection to VDOM selection', () => {
      // Arrange
      const textNode1 = createTextNode('Hello ', [0]);
      const textNode2 = createTextNode('world', [1]);
      const vdom: VDOMNode[] = [textNode1, textNode2];

      const mockTextNodeDOM1 = document.createTextNode('Hello ');
      const mockTextNodeDOM2 = document.createTextNode('world');
      mockRootElement.appendChild(mockTextNodeDOM1);
      mockRootElement.appendChild(mockTextNodeDOM2);

      mockSelectionService.setMockSelectionProperties({
        isCollapsed: false,
        anchorNode: mockTextNodeDOM1,
        anchorOffset: 2,
        focusNode: mockTextNodeDOM2,
        focusOffset: 3,
      });

      // Act
      const result = getSelectionFromBrowser(mockSelectionService, mockRootElement, vdom);

      // Assert
      expect(result.isCollapsed).toBe(false);
      expect(result.start.node).toBe(textNode1);
      expect(result.start.offset).toBe(2);
      expect(result.end.node).toBe(textNode2);
      expect(result.end.offset).toBe(3);
    });

    test('should handle selection within formatted text (nested VDOM structure)', () => {
      // Arrange: <p>Hello <strong>bold</strong> text</p>
      const textNode1 = createTextNode('Hello ', [0, 0]);
      const boldTextNode = createTextNode('bold', [0, 1, 0]);
      const strongNode = createElementNode('strong', [0, 1], [boldTextNode]);
      const textNode2 = createTextNode(' text', [0, 2]);
      const paragraphNode = createElementNode('paragraph', [0], [textNode1, strongNode, textNode2]);
      const vdom: VDOMNode[] = [paragraphNode];

      const mockBoldTextDOM = document.createTextNode('bold');
      const mockStrongDOM = document.createElement('strong');
      mockStrongDOM.appendChild(mockBoldTextDOM);
      mockRootElement.appendChild(mockStrongDOM);

      mockSelectionService.setMockSelectionProperties({
        isCollapsed: false,
        anchorNode: mockBoldTextDOM,
        anchorOffset: 1,
        focusNode: mockBoldTextDOM,
        focusOffset: 3,
      });

      // Act
      const result = getSelectionFromBrowser(mockSelectionService, mockRootElement, vdom);

      // Assert
      expect(result.isCollapsed).toBe(false);
      expect(result.start.node).toBe(boldTextNode);
      expect(result.start.offset).toBe(1);
      expect(result.end.node).toBe(boldTextNode);
      expect(result.end.offset).toBe(3);
    });

    test('should handle selection across multiple DOM text nodes mapping to single VDOM node', () => {
      // This tests the case where browser has split a single logical text into multiple DOM nodes
      // but our VDOM represents it as one node
      const textNode = createTextNode('Hello world test', [0]);
      const vdom: VDOMNode[] = [textNode];

      const mockTextNodeDOM1 = document.createTextNode('Hello ');
      const mockTextNodeDOM2 = document.createTextNode('world ');
      const mockTextNodeDOM3 = document.createTextNode('test');
      mockRootElement.appendChild(mockTextNodeDOM1);
      mockRootElement.appendChild(mockTextNodeDOM2);
      mockRootElement.appendChild(mockTextNodeDOM3);

      mockSelectionService.setMockSelectionProperties({
        isCollapsed: false,
        anchorNode: mockTextNodeDOM1,
        anchorOffset: 2,
        focusNode: mockTextNodeDOM3,
        focusOffset: 2,
      });

      // Act
      const result = getSelectionFromBrowser(mockSelectionService, mockRootElement, vdom);

      // Assert
      expect(result.isCollapsed).toBe(false);
      expect(result.start.node).toBe(textNode);
      expect(result.start.offset).toBe(2); // 'Hello '[2] = 'l'
      expect(result.end.node).toBe(textNode);
      expect(result.end.offset).toBe(14); // 'Hello world te'[14] = position after 'te'
    });
  });

  describe('applySelectionToBrowser', () => {
    test('should set collapsed selection in browser', () => {
      // Arrange
      const textNode = createTextNode('Hello world', [0]);
      const vdom: VDOMNode[] = [textNode];
      const selection = createSelection(textNode, 5, textNode, 5);

      // Act
      applySelectionToBrowser(mockSelectionService, selection, mockRootElement, vdom);

      // Assert
      expect(mockSelectionService.setSelectionRange).toHaveBeenCalled();
      const range = mockSelectionService.createRange();
      expect(range.setStart).toHaveBeenCalled();
      expect(range.collapse).toHaveBeenCalledWith(true);
    });

    test('should set range selection in browser', () => {
      // Arrange
      const textNode1 = createTextNode('Hello ', [0]);
      const textNode2 = createTextNode('world', [1]);
      const vdom: VDOMNode[] = [textNode1, textNode2];
      const selection = createSelection(textNode1, 2, textNode2, 3);

      // Act
      applySelectionToBrowser(mockSelectionService, selection, mockRootElement, vdom);

      // Assert
      expect(mockSelectionService.setSelectionRange).toHaveBeenCalled();
      const range = mockSelectionService.createRange();
      expect(range.setStart).toHaveBeenCalled();
      expect(range.setEnd).toHaveBeenCalled();
    });

    test('should handle selection within nested VDOM structure', () => {
      // Arrange: <p>Hello <strong>bold</strong> text</p>
      const textNode1 = createTextNode('Hello ', [0, 0]);
      const boldTextNode = createTextNode('bold', [0, 1, 0]);
      const strongNode = createElementNode('strong', [0, 1], [boldTextNode]);
      const textNode2 = createTextNode(' text', [0, 2]);
      const paragraphNode = createElementNode('paragraph', [0], [textNode1, strongNode, textNode2]);
      const vdom: VDOMNode[] = [paragraphNode];
      const selection = createSelection(boldTextNode, 1, boldTextNode, 3);

      // Act
      applySelectionToBrowser(mockSelectionService, selection, mockRootElement, vdom);

      // Assert
      expect(mockSelectionService.setSelectionRange).toHaveBeenCalled();
    });

    test('should handle invalid root element gracefully', () => {
      // Arrange
      const textNode = createTextNode('Hello', [0]);
      const vdom: VDOMNode[] = [textNode];
      const selection = createSelection(textNode, 0, textNode, 5);

      // Act & Assert - should not throw
      expect(() => {
        applySelectionToBrowser(
          mockSelectionService,
          selection,
          null as unknown as HTMLElement,
          vdom,
        );
      }).not.toThrow();
    });

    test('should map VDOM selection to correct DOM nodes using node paths', () => {
      // Arrange: Complex nested structure where paths are crucial
      const textNode1 = createTextNode('Start ', [0, 0]);
      const textNode2 = createTextNode('middle', [0, 1, 0]);
      const emNode = createElementNode('em', [0, 1], [textNode2]);
      const textNode3 = createTextNode(' end', [0, 2]);
      const paragraphNode = createElementNode('paragraph', [0], [textNode1, emNode, textNode3]);
      const vdom: VDOMNode[] = [paragraphNode];
      const selection = createSelection(textNode2, 1, textNode3, 2);

      // Act
      applySelectionToBrowser(mockSelectionService, selection, mockRootElement, vdom);

      // Assert
      expect(mockSelectionService.setSelectionRange).toHaveBeenCalled();
      // The implementation should use the node paths to correctly locate the DOM nodes
    });
  });

  describe('getNodesInRange', () => {
    test('should return empty array for collapsed selection', () => {
      // Arrange
      const textNode = createTextNode('Hello world', [0]);
      const vdom: VDOMNode[] = [textNode];
      const selection = createSelection(textNode, 5, textNode, 5);

      // Act
      const result = getNodesInRange(vdom, selection);

      // Assert
      expect(result).toEqual([]);
    });

    test('should return single node for selection within one node', () => {
      // Arrange
      const textNode = createTextNode('Hello world', [0]);
      const vdom: VDOMNode[] = [textNode];
      const selection = createSelection(textNode, 2, textNode, 8);

      // Act
      const result = getNodesInRange(vdom, selection);

      // Assert
      expect(result).toEqual([textNode]);
    });

    test('should return multiple nodes for selection spanning nodes', () => {
      // Arrange
      const textNode1 = createTextNode('Hello ', [0]);
      const textNode2 = createTextNode('world', [1]);
      const textNode3 = createTextNode(' test', [2]);
      const vdom: VDOMNode[] = [textNode1, textNode2, textNode3];
      const selection = createSelection(textNode1, 2, textNode3, 2);

      // Act
      const result = getNodesInRange(vdom, selection);

      // Assert
      expect(result).toEqual([textNode1, textNode2, textNode3]);
    });

    test('should return nodes in nested structure within selection range', () => {
      // Arrange: <p>Hello <strong>bold</strong> text</p>
      const textNode1 = createTextNode('Hello ', [0, 0]);
      const boldTextNode = createTextNode('bold', [0, 1, 0]);
      const strongNode = createElementNode('strong', [0, 1], [boldTextNode]);
      const textNode2 = createTextNode(' text', [0, 2]);
      const paragraphNode = createElementNode('paragraph', [0], [textNode1, strongNode, textNode2]);
      const vdom: VDOMNode[] = [paragraphNode];
      const selection = createSelection(textNode1, 3, textNode2, 2);

      // Act
      const result = getNodesInRange(vdom, selection);

      // Assert
      expect(result).toContain(textNode1);
      expect(result).toContain(boldTextNode);
      expect(result).toContain(strongNode);
      expect(result).toContain(textNode2);
    });

    test('should handle selection that starts and ends within nested nodes', () => {
      // Arrange: Selection from middle of one nested node to middle of another
      const textNode1 = createTextNode('Hello ', [0, 0]);
      const boldText1 = createTextNode('bold', [0, 1, 0]);
      const strongNode = createElementNode('strong', [0, 1], [boldText1]);
      const italicText = createTextNode('italic', [0, 2, 0]);
      const emNode = createElementNode('em', [0, 2], [italicText]);
      const textNode2 = createTextNode(' end', [0, 3]);
      const paragraphNode = createElementNode(
        'paragraph',
        [0],
        [textNode1, strongNode, emNode, textNode2],
      );
      const vdom: VDOMNode[] = [paragraphNode];
      const selection = createSelection(boldText1, 1, italicText, 3);

      // Act
      const result = getNodesInRange(vdom, selection);

      // Assert
      expect(result).toContain(boldText1);
      expect(result).toContain(strongNode);
      expect(result).toContain(italicText);
      expect(result).toContain(emNode);
    });

    test('should use node paths to determine range inclusion', () => {
      // This test ensures the implementation correctly uses the path information
      // to determine which nodes fall within the selection range
      const node1 = createTextNode('First', [0]);
      const node2 = createTextNode('Second', [1, 0]);
      const container = createElementNode('paragraph', [1], [node2]);
      const node3 = createTextNode('Third', [2]);
      const vdom: VDOMNode[] = [node1, container, node3];
      const selection = createSelection(node1, 2, node3, 2);

      // Act
      const result = getNodesInRange(vdom, selection);

      // Assert
      expect(result).toContain(node1);
      expect(result).toContain(node2);
      expect(result).toContain(container);
      expect(result).toContain(node3);
    });
  });

  describe('getFormattingAtSelection', () => {
    test('should return inactive formatting for collapsed selection in plain text', () => {
      // Arrange
      const textNode = createTextNode('Hello world', [0]);
      const vdom: VDOMNode[] = [textNode];
      const selection = createSelection(textNode, 5, textNode, 5);

      // Act
      const result = getFormattingAtSelection(vdom, selection);

      // Assert
      expect(result).toEqual({
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      });
    });

    test('should return active formatting for selection within formatted text', () => {
      // Arrange: Selection within <strong>bold</strong>
      const boldTextNode = createTextNode('bold text', [0, 0]);
      const strongNode = createElementNode('strong', [0], [boldTextNode]);
      const vdom: VDOMNode[] = [strongNode];
      const selection = createSelection(boldTextNode, 1, boldTextNode, 4);

      // Act
      const result = getFormattingAtSelection(vdom, selection);

      // Assert
      expect(result.bold).toBe('active');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should return mixed formatting for selection spanning formatted and unformatted text', () => {
      // Arrange: Selection from plain text into <strong>bold</strong>
      const plainTextNode = createTextNode('plain ', [0]);
      const boldTextNode = createTextNode('bold', [1, 0]);
      const strongNode = createElementNode('strong', [1], [boldTextNode]);
      const vdom: VDOMNode[] = [plainTextNode, strongNode];
      const selection = createSelection(plainTextNode, 3, boldTextNode, 2);

      // Act
      const result = getFormattingAtSelection(vdom, selection);

      // Assert
      expect(result.bold).toBe('mixed');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should handle multiple overlapping formats', () => {
      // Arrange: <strong><em>bold and italic</em></strong>
      const textNode = createTextNode('bold and italic', [0, 0, 0]);
      const emNode = createElementNode('em', [0, 0], [textNode]);
      const strongNode = createElementNode('strong', [0], [emNode]);
      const vdom: VDOMNode[] = [strongNode];
      const selection = createSelection(textNode, 5, textNode, 8);

      // Act
      const result = getFormattingAtSelection(vdom, selection);

      // Assert
      expect(result.bold).toBe('active');
      expect(result.italic).toBe('active');
      expect(result.underline).toBe('inactive');
    });

    test('should return correct formatting for complex nested selection', () => {
      // Arrange: Selection across multiple formatting levels
      // <p>Plain <strong>bold <em>both</em></strong> <u>underline</u></p>
      const plainText = createTextNode('Plain ', [0, 0]);
      const boldText = createTextNode('bold ', [0, 1, 0]);
      const bothText = createTextNode('both', [0, 1, 1, 0]);
      const emNode = createElementNode('em', [0, 1, 1], [bothText]);
      const strongNode = createElementNode('strong', [0, 1], [boldText, emNode]);
      const spaceText = createTextNode(' ', [0, 2]);
      const underlineText = createTextNode('underline', [0, 3, 0]);
      const uNode = createElementNode('u', [0, 3], [underlineText]);
      const paragraphNode = createElementNode(
        'paragraph',
        [0],
        [plainText, strongNode, spaceText, uNode],
      );
      const vdom: VDOMNode[] = [paragraphNode];

      // Selection from "bold" to "underline"
      const selection = createSelection(boldText, 1, underlineText, 5);

      // Act
      const result = getFormattingAtSelection(vdom, selection);

      // Assert
      expect(result.bold).toBe('mixed'); // Some bold, some not
      expect(result.italic).toBe('mixed'); // Some italic, some not
      expect(result.underline).toBe('mixed'); // Some underlined, some not
    });

    test('should handle empty selection range', () => {
      // Arrange
      const textNode = createTextNode('Hello', [0]);
      const vdom: VDOMNode[] = [textNode];
      const selection = createSelection(textNode, 0, textNode, 0);

      // Act
      const result = getFormattingAtSelection(vdom, selection);

      // Assert
      expect(result).toEqual({
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      });
    });

    test('should analyze formatting based on selected nodes and their ancestors', () => {
      // This test ensures the implementation correctly traverses up the VDOM tree
      // using node paths to determine inherited formatting
      const textNode = createTextNode('nested text', [0, 0, 0]);
      const uNode = createElementNode('u', [0, 0], [textNode]);
      const strongNode = createElementNode('strong', [0], [uNode]);
      const vdom: VDOMNode[] = [strongNode];
      const selection = createSelection(textNode, 2, textNode, 6);

      // Act
      const result = getFormattingAtSelection(vdom, selection);

      // Assert
      expect(result.bold).toBe('active'); // Inherited from strong ancestor
      expect(result.underline).toBe('active'); // Inherited from u ancestor
      expect(result.italic).toBe('inactive');
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty VDOM gracefully', () => {
      // Arrange
      const vdom: VDOMNode[] = [];

      // Act & Assert
      expect(() => {
        getSelectionFromBrowser(mockSelectionService, mockRootElement, vdom);
      }).not.toThrow();

      expect(() => {
        getNodesInRange(vdom, {} as VDOMSelection);
      }).not.toThrow();

      expect(() => {
        getFormattingAtSelection(vdom, {} as VDOMSelection);
      }).not.toThrow();
    });

    test('should handle malformed node paths', () => {
      // Arrange
      const textNode = createTextNode('Hello', [-1, 999]); // Invalid path
      const vdom: VDOMNode[] = [textNode];
      const selection = createSelection(textNode, 0, textNode, 5);

      // Act & Assert - should not throw
      expect(() => {
        getNodesInRange(vdom, selection);
      }).not.toThrow();

      expect(() => {
        getFormattingAtSelection(vdom, selection);
      }).not.toThrow();
    });

    test('should handle selection with nodes not in provided VDOM', () => {
      // Arrange
      const vdomNode = createTextNode('Hello', [0]);
      const orphanNode = createTextNode('World', [999]); // Not in VDOM
      const vdom: VDOMNode[] = [vdomNode];
      const selection = createSelection(orphanNode, 0, orphanNode, 5);

      // Act & Assert - should handle gracefully
      expect(() => {
        getNodesInRange(vdom, selection);
      }).not.toThrow();

      expect(() => {
        getFormattingAtSelection(vdom, selection);
      }).not.toThrow();
    });
  });
});
