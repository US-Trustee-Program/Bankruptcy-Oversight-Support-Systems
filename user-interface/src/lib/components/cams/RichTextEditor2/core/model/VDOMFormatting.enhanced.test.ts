import { describe, test, expect, beforeEach } from 'vitest';
import { getNodesInSelection, getFormattingAtSelection } from './VDOMFormatting';
import { VDOMNode, VDOMSelection } from '../types';

describe('Enhanced VDOMFormatting Functions for Cursor Position', () => {
  let mockVDOM: VDOMNode[];
  let mockSelection: VDOMSelection;

  beforeEach(() => {
    mockVDOM = [];
    mockSelection = {
      start: { offset: 0 },
      end: { offset: 0 },
      isCollapsed: true,
    };
  });

  describe('getNodesInSelection with collapsed cursor support', () => {
    test('should return empty array when VDOM is empty and cursor is at position 0', () => {
      mockVDOM = [];
      mockSelection = { start: { offset: 0 }, end: { offset: 0 }, isCollapsed: true };

      const result = getNodesInSelection(
        mockVDOM,
        mockSelection.start.offset,
        mockSelection.end.offset,
      );

      expect(result).toEqual([]);
    });

    test('should return formatting context when cursor is at position 0 in text', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];
      mockSelection = { start: { offset: 0 }, end: { offset: 0 }, isCollapsed: true };

      const result = getNodesInSelection(
        mockVDOM,
        mockSelection.start.offset,
        mockSelection.end.offset,
      );

      // At position 0, there's no character to the left, so context should be empty
      expect(result).toEqual([]);
    });

    test('should return text node context when cursor is after plain text character', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];
      mockSelection = { start: { offset: 1 }, end: { offset: 1 }, isCollapsed: true };

      const result = getNodesInSelection(
        mockVDOM,
        mockSelection.start.offset,
        mockSelection.end.offset,
      );

      // Should return the text node that contains the character to the left of cursor
      expect(result).toContainEqual(
        expect.objectContaining({
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        }),
      );
    });

    test('should return strong node context when cursor is after bold text character', () => {
      mockVDOM = [
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-1',
              type: 'text',
              content: 'Bold',
            },
          ],
        },
      ];
      mockSelection = { start: { offset: 1 }, end: { offset: 1 }, isCollapsed: true };

      const result = getNodesInSelection(
        mockVDOM,
        mockSelection.start.offset,
        mockSelection.end.offset,
      );

      // Should return the strong node that contains the character to the left of cursor
      expect(result).toContainEqual(
        expect.objectContaining({
          id: 'strong-1',
          type: 'strong',
        }),
      );
    });

    test('should return text node context when cursor transitions from bold to plain text', () => {
      mockVDOM = [
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-1',
              type: 'text',
              content: 'Bold',
            },
          ],
        },
        {
          id: 'text-2',
          type: 'text',
          content: ' plain',
        },
      ];
      mockSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true }; // After "Bold "

      const result = getNodesInSelection(
        mockVDOM,
        mockSelection.start.offset,
        mockSelection.end.offset,
      );

      // Character to the left is a space in plain text, should return plain text node
      expect(result).toContainEqual(
        expect.objectContaining({
          id: 'text-2',
          type: 'text',
          content: ' plain',
        }),
      );
    });

    test('should return strong node context when cursor transitions from plain to bold text', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Plain ',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'bold',
            },
          ],
        },
      ];
      mockSelection = { start: { offset: 7 }, end: { offset: 7 }, isCollapsed: true }; // After "Plain b"

      const result = getNodesInSelection(
        mockVDOM,
        mockSelection.start.offset,
        mockSelection.end.offset,
      );

      // Character to the left is 'b' in bold text, should return strong node
      expect(result).toContainEqual(
        expect.objectContaining({
          id: 'strong-1',
          type: 'strong',
        }),
      );
    });

    test('should handle range selection spanning multiple formatting contexts', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Plain ',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'bold',
            },
          ],
        },
        {
          id: 'text-3',
          type: 'text',
          content: ' text',
        },
      ];
      mockSelection = { start: { offset: 3 }, end: { offset: 8 }, isCollapsed: false }; // "in bold"

      const result = getNodesInSelection(
        mockVDOM,
        mockSelection.start.offset,
        mockSelection.end.offset,
      );

      // Should return all nodes that contribute to the selection
      expect(result).toContainEqual(
        expect.objectContaining({
          id: 'text-1',
          type: 'text',
        }),
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          id: 'strong-1',
          type: 'strong',
        }),
      );
    });
  });

  describe('getFormattingAtSelection enhanced for cursor position', () => {
    test('should return inactive formatting when cursor is at position 0', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];

      // Simulate getting nodes at collapsed cursor position
      const selectedNodes = getNodesInSelection(mockVDOM, 0, 0);
      const result = getFormattingAtSelection(selectedNodes);

      expect(result).toEqual({
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      });
    });

    test('should return inactive formatting when cursor is after plain text', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];

      const selectedNodes = getNodesInSelection(mockVDOM, 5, 5);
      const result = getFormattingAtSelection(selectedNodes);

      expect(result).toEqual({
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      });
    });

    test('should return active bold formatting when cursor is after bold text', () => {
      mockVDOM = [
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-1',
              type: 'text',
              content: 'Bold text',
            },
          ],
        },
      ];

      const selectedNodes = getNodesInSelection(mockVDOM, 5, 5);
      const result = getFormattingAtSelection(selectedNodes);

      expect(result.bold).toBe('active');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should return correct formatting when cursor is at boundary between different formats', () => {
      mockVDOM = [
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-1',
              type: 'text',
              content: 'Bold',
            },
          ],
        },
        {
          id: 'text-2',
          type: 'text',
          content: ' plain',
        },
      ];

      // Test cursor just after bold text (position 4, after "Bold")
      let selectedNodes = getNodesInSelection(mockVDOM, 4, 4);
      let result = getFormattingAtSelection(selectedNodes);
      expect(result.bold).toBe('active'); // Character to left is bold

      // Test cursor after space (position 5, after "Bold ")
      selectedNodes = getNodesInSelection(mockVDOM, 5, 5);
      result = getFormattingAtSelection(selectedNodes);
      expect(result.bold).toBe('inactive'); // Character to left is plain
    });

    test('should handle mixed formatting correctly for range selections', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Plain ',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'bold',
            },
          ],
        },
        {
          id: 'text-3',
          type: 'text',
          content: ' text',
        },
      ];

      // Select range spanning both plain and bold text
      const selectedNodes = getNodesInSelection(mockVDOM, 3, 8); // "in bold"
      const result = getFormattingAtSelection(selectedNodes);

      expect(result.bold).toBe('mixed'); // Some text is bold, some is not
    });
  });

  describe('Integration: Cursor position detection with existing functions', () => {
    test('should properly detect formatting context as cursor moves through mixed content', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Start ',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'bold',
            },
          ],
        },
        {
          id: 'text-3',
          type: 'text',
          content: ' end',
        },
      ];

      // Test various cursor positions
      const positions = [
        { offset: 0, expectedBold: 'inactive' }, // Before "Start"
        { offset: 3, expectedBold: 'inactive' }, // In "Start" (position 3 = after "Sta")
        { offset: 6, expectedBold: 'inactive' }, // After "Start "
        { offset: 7, expectedBold: 'active' }, // In "bold" (position 7 = after "Start b")
        { offset: 10, expectedBold: 'active' }, // End of "bold"
        { offset: 11, expectedBold: 'inactive' }, // In " end"
      ];

      positions.forEach(({ offset, expectedBold }) => {
        const selectedNodes = getNodesInSelection(mockVDOM, offset, offset);
        const result = getFormattingAtSelection(selectedNodes);
        expect(result.bold).toBe(expectedBold);
      });
    });

    test('should handle edge cases like empty content and boundary conditions', () => {
      // Empty VDOM
      let selectedNodes = getNodesInSelection([], 0, 0);
      let result = getFormattingAtSelection(selectedNodes);
      expect(result.bold).toBe('inactive');

      // Single character bold text
      mockVDOM = [
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-1',
              type: 'text',
              content: 'B',
            },
          ],
        },
      ];

      selectedNodes = getNodesInSelection(mockVDOM, 0, 0); // Before "B"
      result = getFormattingAtSelection(selectedNodes);
      expect(result.bold).toBe('inactive');

      selectedNodes = getNodesInSelection(mockVDOM, 1, 1); // After "B"
      result = getFormattingAtSelection(selectedNodes);
      expect(result.bold).toBe('active');
    });
  });
});
