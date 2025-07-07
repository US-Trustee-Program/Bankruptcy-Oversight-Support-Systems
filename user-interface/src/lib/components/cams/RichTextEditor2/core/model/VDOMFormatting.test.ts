import { test, expect, describe } from 'vitest';
import { VDOMNode, VDOMSelection } from '../types';
import { createTextNode, createParagraphNode, createStrongNode, createEmNode } from './VDOMNode';
import {
  getFormattingAtSelection,
  getNodeFormatState,
  toggleBoldInSelection,
  isTextNodeBold,
} from './VDOMFormatting';

// Remove temporary function declarations since they're now implemented

describe('VDOMFormatting', () => {
  describe('getNodeFormatState', () => {
    test('should detect bold formatting on a strong node', () => {
      // Arrange
      const strongNode = createStrongNode([createTextNode('bold text')]);

      // Act
      const result = getNodeFormatState(strongNode);

      // Assert
      expect(result.bold).toBe('active');
      expect(result.italic).toBeUndefined();
      expect(result.underline).toBeUndefined();
    });

    test('should detect italic formatting on an em node', () => {
      // Arrange
      const emNode = createEmNode([createTextNode('italic text')]);

      // Act
      const result = getNodeFormatState(emNode);

      // Assert
      expect(result.bold).toBeUndefined();
      expect(result.italic).toBe('active');
      expect(result.underline).toBeUndefined();
    });

    test('should detect underline formatting on a u node', () => {
      // Arrange
      const node: VDOMNode = {
        id: '1',
        type: 'u',
        children: [
          {
            id: '2',
            type: 'text',
            content: 'Underlined text',
          },
        ],
      };

      // Act
      const result = getNodeFormatState(node);

      // Assert
      expect(result.underline).toBe('active');
      expect(result.bold).toBeUndefined();
      expect(result.italic).toBeUndefined();
    });

    test('should not detect any formatting on a text node', () => {
      // Arrange
      const textNode = createTextNode('plain text');

      // Act
      const result = getNodeFormatState(textNode);

      // Assert
      expect(result.bold).toBeUndefined();
      expect(result.italic).toBeUndefined();
      expect(result.underline).toBeUndefined();
    });

    test('should not detect any formatting on a paragraph node', () => {
      // Arrange
      const paragraphNode = createParagraphNode([createTextNode('plain text')]);

      // Act
      const result = getNodeFormatState(paragraphNode);

      // Assert
      expect(result.bold).toBeUndefined();
      expect(result.italic).toBeUndefined();
      expect(result.underline).toBeUndefined();
    });
  });

  describe('getFormattingAtSelection', () => {
    test('should return all inactive when no nodes are selected', () => {
      // Arrange
      const nodes: VDOMNode[] = [];

      // Act
      const result = getFormattingAtSelection(nodes);

      // Assert
      expect(result.bold).toBe('inactive');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should return active for formats that all selected nodes have', () => {
      // Arrange
      const nodes: VDOMNode[] = [
        createStrongNode([createTextNode('bold text')]),
        createStrongNode([createTextNode('more bold text')]),
      ];

      // Act
      const result = getFormattingAtSelection(nodes);

      // Assert
      expect(result.bold).toBe('active');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should return mixed when some nodes have a format and others do not', () => {
      // Arrange
      const nodes: VDOMNode[] = [
        createStrongNode([createTextNode('bold text')]),
        createTextNode('plain text'),
      ];

      // Act
      const result = getFormattingAtSelection(nodes);

      // Assert
      expect(result.bold).toBe('mixed');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should return inactive for nodes with no formatting', () => {
      // Arrange
      const nodes: VDOMNode[] = [createTextNode('plain text'), createTextNode('more plain text')];

      // Act
      const result = getFormattingAtSelection(nodes);

      // Assert
      expect(result.bold).toBe('inactive');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });
  });

  describe('toggleBoldInSelection', () => {
    test('should wrap a plain text node with strong formatting', () => {
      // Arrange
      const textNode = createTextNode('Hello world');
      const vdom = [textNode];
      const selection: VDOMSelection = {
        start: { offset: 0 },
        end: { offset: 11 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('strong');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children![0].type).toBe('text');
      expect(result[0].children![0].content).toBe('Hello world');
    });

    test('should unwrap text from strong formatting when already bold', () => {
      // Arrange
      const textNode = createTextNode('Bold text');
      const strongNode = createStrongNode([textNode]);
      const vdom = [strongNode];
      const selection: VDOMSelection = {
        start: { offset: 0 },
        end: { offset: 9 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('Bold text');
      expect(result[0].children).toBeUndefined();
    });

    test('should handle collapsed selection by toggling entire text node', () => {
      // Arrange
      const textNode = createTextNode('Hello');
      const vdom = [textNode];
      const selection: VDOMSelection = {
        start: { offset: 2 },
        end: { offset: 2 },
        isCollapsed: true,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('strong');
      expect(result[0].children![0].content).toBe('Hello');
    });

    test('should handle empty vdom array', () => {
      // Arrange
      const vdom: VDOMNode[] = [];
      const selection: VDOMSelection = {
        start: { offset: 0 },
        end: { offset: 0 },
        isCollapsed: true,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert
      expect(result).toEqual([]);
    });

    test('should only affect text nodes within selection range', () => {
      // Arrange
      const textNode1 = createTextNode('First');
      const textNode2 = createTextNode('Second');
      const vdom = [textNode1, textNode2];
      const selection: VDOMSelection = {
        start: { offset: 0 },
        end: { offset: 5 }, // Only covers first text node
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('strong'); // First node should be wrapped
      expect(result[1].type).toBe('text'); // Second node should remain unchanged
      expect(result[1].content).toBe('Second');
    });
  });

  describe('toggleBoldInSelection - Partial Text Selection', () => {
    test('should only toggle bold on selected portion of text node (beginning)', () => {
      // Arrange: "Hello world" with selection on "Hello" (0-5)
      const textNode = createTextNode('Hello world');
      const vdom = [textNode];
      const selection: VDOMSelection = {
        start: { offset: 0 },
        end: { offset: 5 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should split into bold "Hello" + plain " world"
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('strong');
      expect(result[0].children![0].content).toBe('Hello');
      expect(result[1].type).toBe('text');
      expect(result[1].content).toBe(' world');
    });

    test('should only toggle bold on selected portion of text node (middle)', () => {
      // Arrange: "Hello world" with selection on "lo wo" (3-8)
      const textNode = createTextNode('Hello world');
      const vdom = [textNode];
      const selection: VDOMSelection = {
        start: { offset: 3 },
        end: { offset: 8 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should split into "Hel" + bold "lo wo" + "rld"
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('Hel');
      expect(result[1].type).toBe('strong');
      expect(result[1].children![0].content).toBe('lo wo');
      expect(result[2].type).toBe('text');
      expect(result[2].content).toBe('rld');
    });

    test('should only toggle bold on selected portion of text node (end)', () => {
      // Arrange: "Hello world" with selection on "world" (6-11)
      const textNode = createTextNode('Hello world');
      const vdom = [textNode];
      const selection: VDOMSelection = {
        start: { offset: 6 },
        end: { offset: 11 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should split into "Hello " + bold "world"
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('Hello ');
      expect(result[1].type).toBe('strong');
      expect(result[1].children![0].content).toBe('world');
    });
  });

  describe('toggleBoldInSelection - Toggle Off Scenarios', () => {
    test('should remove bold from fully selected bold text', () => {
      // Arrange: Bold "Hello world" with full selection
      const textNode = createTextNode('Hello world');
      const strongNode = createStrongNode([textNode]);
      const vdom = [strongNode];
      const selection: VDOMSelection = {
        start: { offset: 0 },
        end: { offset: 11 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should unwrap to plain text
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('Hello world');
    });

    test('should remove bold from partial selection within bold text (beginning)', () => {
      // Arrange: Bold "Hello world" with selection on "Hello" (0-5)
      const textNode = createTextNode('Hello world');
      const strongNode = createStrongNode([textNode]);
      const vdom = [strongNode];
      const selection: VDOMSelection = {
        start: { offset: 0 },
        end: { offset: 5 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should split into plain "Hello" + bold " world"
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('Hello');
      expect(result[1].type).toBe('strong');
      expect(result[1].children![0].content).toBe(' world');
    });

    test('should remove bold from partial selection within bold text (middle)', () => {
      // Arrange: Bold "Hello world" with selection on "lo wo" (3-8)
      const textNode = createTextNode('Hello world');
      const strongNode = createStrongNode([textNode]);
      const vdom = [strongNode];
      const selection: VDOMSelection = {
        start: { offset: 3 },
        end: { offset: 8 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should split into bold "Hel" + plain "lo wo" + bold "rld"
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('strong');
      expect(result[0].children![0].content).toBe('Hel');
      expect(result[1].type).toBe('text');
      expect(result[1].content).toBe('lo wo');
      expect(result[2].type).toBe('strong');
      expect(result[2].children![0].content).toBe('rld');
    });

    test('should remove bold from partial selection within bold text (end)', () => {
      // Arrange: Bold "Hello world" with selection on "world" (6-11)
      const textNode = createTextNode('Hello world');
      const strongNode = createStrongNode([textNode]);
      const vdom = [strongNode];
      const selection: VDOMSelection = {
        start: { offset: 6 },
        end: { offset: 11 },
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should split into bold "Hello " + plain "world"
      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('strong');
      expect(result[0].children![0].content).toBe('Hello ');
      expect(result[1].type).toBe('text');
      expect(result[1].content).toBe('world');
    });

    test('should handle collapsed selection within bold text', () => {
      // Arrange: Bold "Hello world" with collapsed selection at position 5
      const textNode = createTextNode('Hello world');
      const strongNode = createStrongNode([textNode]);
      const vdom = [strongNode];
      const selection: VDOMSelection = {
        start: { offset: 5 },
        end: { offset: 5 },
        isCollapsed: true,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should unwrap entire bold text (current behavior expectation)
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('Hello world');
    });
  });

  describe('toggleBoldInSelection - Complex Multi-Node Scenarios', () => {
    test('should handle selection spanning multiple text nodes', () => {
      // Arrange: Two text nodes "Hello " and "world" with selection spanning both
      const textNode1 = createTextNode('Hello ');
      const textNode2 = createTextNode('world');
      const vdom = [textNode1, textNode2];
      const selection: VDOMSelection = {
        start: { offset: 3 }, // Middle of first node (position 3 = "l")
        end: { offset: 8 }, // Middle of second node (position 8 = "o" in "world")
        isCollapsed: false,
      };
      // Total text: "Hello world" (positions 0-10)
      // Selection covers: "lo wo" (positions 3-7, inclusive)

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should split and format affected portions
      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('text');
      expect(result[0].content).toBe('Hel'); // Before selection
      expect(result[1].type).toBe('strong');
      expect(result[1].children![0].content).toBe('lo wo'); // Selected text
      expect(result[2].type).toBe('text');
      expect(result[2].content).toBe('rld'); // After selection
    });

    test('should handle mixed formatting state correctly', () => {
      // Arrange: Bold "Hello " and plain "world" with selection spanning both
      const textNode1 = createTextNode('Hello ');
      const strongNode = createStrongNode([textNode1]);
      const textNode2 = createTextNode('world');
      const vdom = [strongNode, textNode2];
      const selection: VDOMSelection = {
        start: { offset: 3 }, // Middle of bold text
        end: { offset: 8 }, // Middle of plain text (6 + 2)
        isCollapsed: false,
      };

      // Act
      const result = toggleBoldInSelection(vdom, selection);

      // Assert: Should determine dominant formatting and apply consistently
      // This test helps verify the logic for mixed format detection
      expect(result.length).toBeGreaterThan(0);
      // Specific expectations will depend on the implemented behavior
    });
  });

  describe('isTextNodeBold', () => {
    test('should return true for text node wrapped in strong', () => {
      // Arrange
      const textNode = createTextNode('Bold text');
      const strongNode = createStrongNode([textNode]);

      // Act
      const result = isTextNodeBold(textNode, [strongNode]);

      // Assert
      expect(result).toBe(true);
    });

    test('should return false for plain text node', () => {
      // Arrange
      const textNode = createTextNode('Plain text');

      // Act
      const result = isTextNodeBold(textNode, [textNode]);

      // Assert
      expect(result).toBe(false);
    });

    test('should return false for text node in non-strong container', () => {
      // Arrange
      const textNode = createTextNode('Italic text');
      const emNode = createEmNode([textNode]);

      // Act
      const result = isTextNodeBold(textNode, [emNode]);

      // Assert
      expect(result).toBe(false);
    });
  });

  test('should toggle OFF bold when entire bold text is selected', () => {
    // Start with bold text - this is the problematic scenario
    const initialVdom: VDOMNode[] = [createStrongNode([createTextNode('This is a test')])];

    // Select the entire text (0 to 14)
    const selection: VDOMSelection = {
      start: { offset: 0 },
      end: { offset: 14 },
      isCollapsed: false,
    };

    // Toggle bold - should REMOVE bold since text is already bold
    const result = toggleBoldInSelection(initialVdom, selection);

    // Expected: Should return plain text node (ignoring ID)
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(result[0].content).toBe('This is a test');
    expect(result[0].children).toBeUndefined();
  });
});
