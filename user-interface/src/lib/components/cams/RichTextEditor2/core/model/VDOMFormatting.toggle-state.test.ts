import { describe, test, expect, beforeEach } from 'vitest';
import { getFormatStateAtCursorPosition, insertTextWithFormatting } from './VDOMFormatting';
import { VDOMNode, VDOMSelection, FormatToggleState } from '../types';

describe('Format Toggle State Tracking', () => {
  let mockVDOM: VDOMNode[];
  let mockSelection: VDOMSelection;

  beforeEach(() => {
    // Reset test data before each test
    mockVDOM = [];
    mockSelection = {
      start: { offset: 0 },
      end: { offset: 0 },
      isCollapsed: true,
    };
  });

  describe('getFormatStateAtCursorPosition', () => {
    test('should return inactive bold state when cursor is at position 0 in empty document', () => {
      mockVDOM = [];
      mockSelection = { start: { offset: 0 }, end: { offset: 0 }, isCollapsed: true };

      const result = getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold');

      expect(result).toBe('inactive');
    });

    test('should return inactive bold state when cursor is at position 0 with text content', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];
      mockSelection = { start: { offset: 0 }, end: { offset: 0 }, isCollapsed: true };

      const result = getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold');

      expect(result).toBe('inactive');
    });

    test('should return inactive bold state when cursor is after plain text character', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];
      mockSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true };

      const result = getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold');

      expect(result).toBe('inactive');
    });

    test('should return active bold state when cursor is after bold text character', () => {
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
      mockSelection = { start: { offset: 4 }, end: { offset: 4 }, isCollapsed: true };

      const result = getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold');

      expect(result).toBe('active');
    });

    test('should return active bold state when cursor is in middle of bold text', () => {
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
      mockSelection = { start: { offset: 2 }, end: { offset: 2 }, isCollapsed: true };

      const result = getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold');

      expect(result).toBe('active');
    });

    test('should return inactive bold state when cursor moves from bold to plain text boundary', () => {
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
      mockSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true };

      const result = getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold');

      expect(result).toBe('inactive');
    });

    test('should return active bold state when cursor moves from plain to bold text boundary', () => {
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
      mockSelection = { start: { offset: 7 }, end: { offset: 7 }, isCollapsed: true };

      const result = getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold');

      expect(result).toBe('active');
    });
  });

  describe('Toggle State Management in FSM Integration', () => {
    test('should toggle from inactive to active when user toggles bold in plain text', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Plain text',
        },
      ];
      mockSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true };

      // Step 1: Calculate current toggle state based on cursor position
      const currentToggleState: FormatToggleState = {
        bold: getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold'),
        italic: getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'italic'),
        underline: getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'underline'),
      };
      expect(currentToggleState.bold).toBe('inactive');

      // Step 2: User toggles bold (FSM would flip the state)
      const newToggleState: FormatToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(newToggleState.bold).toBe('active');
    });

    test('should toggle from active to inactive when user toggles bold in bold text', () => {
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
      mockSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true };

      const currentToggleState: FormatToggleState = {
        bold: getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold'),
        italic: getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'italic'),
        underline: getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'underline'),
      };
      expect(currentToggleState.bold).toBe('active');

      const newToggleState: FormatToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(newToggleState.bold).toBe('inactive');
    });

    test('should allow multiple toggles without cursor movement by flipping current state', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Plain text',
        },
      ];
      mockSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true };

      // Start with cursor-based state
      let currentToggleState: FormatToggleState = {
        bold: getFormatStateAtCursorPosition(mockVDOM, mockSelection, 'bold'),
        italic: 'inactive',
        underline: 'inactive',
      };
      expect(currentToggleState.bold).toBe('inactive');

      // First toggle: inactive -> active
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('active');

      // Second toggle: active -> inactive
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('inactive');

      // Third toggle: inactive -> active
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('active');
    });

    test('should recalculate toggle state based on new cursor position when cursor moves', () => {
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

      // Start with cursor in plain text
      let currentSelection = { start: { offset: 3 }, end: { offset: 3 }, isCollapsed: true };
      let currentToggleState: FormatToggleState = {
        bold: getFormatStateAtCursorPosition(mockVDOM, currentSelection, 'bold'),
        italic: 'inactive',
        underline: 'inactive',
      };
      expect(currentToggleState.bold).toBe('inactive'); // In plain text

      // User toggles bold (becomes decoupled from cursor position)
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('active'); // Now active due to toggle

      // Cursor moves to bold text area
      currentSelection = { start: { offset: 8 }, end: { offset: 8 }, isCollapsed: true };

      // FSM should recalculate toggle state based on new cursor position
      currentToggleState = {
        bold: getFormatStateAtCursorPosition(mockVDOM, currentSelection, 'bold'),
        italic: getFormatStateAtCursorPosition(mockVDOM, currentSelection, 'italic'),
        underline: getFormatStateAtCursorPosition(mockVDOM, currentSelection, 'underline'),
      };
      expect(currentToggleState.bold).toBe('active'); // Now active due to cursor position in bold text
    });
  });

  describe('insertTextWithFormatting', () => {
    test('should insert plain text when toggle state bold is inactive', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];
      mockSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true };
      const toggleState: FormatToggleState = {
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      };

      const result = insertTextWithFormatting(mockVDOM, mockSelection, ' inserted', toggleState);

      // Should insert plain text at position 5
      expect(result.newVDOM).toEqual([
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello inserted world',
        },
      ]);

      // Cursor should be after inserted text
      expect(result.newSelection.start.offset).toBe(14); // 5 + ' inserted'.length
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('should insert bold text when toggle state bold is active in plain text context', () => {
      mockVDOM = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];
      mockSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true };
      const toggleState: FormatToggleState = {
        bold: 'active',
        italic: 'inactive',
        underline: 'inactive',
      };

      const result = insertTextWithFormatting(mockVDOM, mockSelection, ' bold', toggleState);

      // Should split text and insert bold formatting
      expect(result.newVDOM).toHaveLength(3);
      expect(result.newVDOM[0]).toEqual({
        id: 'text-1',
        type: 'text',
        content: 'Hello',
      });
      expect(result.newVDOM[1].type).toBe('strong');
      expect(result.newVDOM[1].children).toEqual([
        expect.objectContaining({
          type: 'text',
          content: ' bold',
        }),
      ]);
      expect(result.newVDOM[2]).toEqual(
        expect.objectContaining({
          type: 'text',
          content: ' world',
        }),
      );

      // Cursor should be after inserted text
      expect(result.newSelection.start.offset).toBe(10); // 5 + ' bold'.length
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('should insert plain text when toggle state bold is inactive in bold text context', () => {
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
      mockSelection = { start: { offset: 4 }, end: { offset: 4 }, isCollapsed: true };
      const toggleState: FormatToggleState = {
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      };

      const result = insertTextWithFormatting(mockVDOM, mockSelection, ' plain', toggleState);

      // Should split bold text and insert plain text
      expect(result.newVDOM).toHaveLength(3);
      expect(result.newVDOM[0].type).toBe('strong');
      expect(result.newVDOM[0].children).toEqual([
        expect.objectContaining({
          type: 'text',
          content: 'Bold',
        }),
      ]);
      expect(result.newVDOM[1]).toEqual(
        expect.objectContaining({
          type: 'text',
          content: ' plain',
        }),
      );
      expect(result.newVDOM[2].type).toBe('strong');
      expect(result.newVDOM[2].children).toEqual([
        expect.objectContaining({
          type: 'text',
          content: ' text',
        }),
      ]);

      expect(result.newSelection.start.offset).toBe(10); // 4 + ' plain'.length
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('should continue bold formatting when toggle state bold is active in bold text context', () => {
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
      mockSelection = { start: { offset: 4 }, end: { offset: 4 }, isCollapsed: true };
      const toggleState: FormatToggleState = {
        bold: 'active',
        italic: 'inactive',
        underline: 'inactive',
      };

      const result = insertTextWithFormatting(mockVDOM, mockSelection, ' more', toggleState);

      // Should extend existing bold formatting
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].type).toBe('strong');
      expect(result.newVDOM[0].children).toEqual([
        expect.objectContaining({
          type: 'text',
          content: 'Bold more text',
        }),
      ]);

      expect(result.newSelection.start.offset).toBe(9); // 4 + ' more'.length
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('should handle complex mixed formatting scenarios', () => {
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
      mockSelection = { start: { offset: 10 }, end: { offset: 10 }, isCollapsed: true }; // After 'bold'
      const toggleState: FormatToggleState = {
        bold: 'active', // Toggle state override
        italic: 'inactive',
        underline: 'inactive',
      };

      const result = insertTextWithFormatting(mockVDOM, mockSelection, ' inserted', toggleState);

      // Should extend the bold formatting
      expect(result.newVDOM).toContainEqual(
        expect.objectContaining({
          type: 'strong',
          children: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              content: expect.stringContaining('inserted'),
            }),
          ]),
        }),
      );

      expect(result.newSelection.start.offset).toBe(19); // 10 + ' inserted'.length
    });
  });

  describe('Integration: Full Toggle State Workflow', () => {
    test('should demonstrate complete user workflow: move cursor, toggle format, type text', () => {
      // Initial state: plain text with cursor at position 5
      let currentVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];
      let currentSelection = { start: { offset: 5 }, end: { offset: 5 }, isCollapsed: true };

      // Step 1: Calculate initial toggle state based on cursor position
      let currentToggleState: FormatToggleState = {
        bold: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'bold'),
        italic: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'italic'),
        underline: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'underline'),
      };
      expect(currentToggleState.bold).toBe('inactive');

      // Step 2: User toggles bold (FSM would flip the state)
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('active');

      // Step 3: User types text (should be inserted with bold formatting)
      const insertResult = insertTextWithFormatting(
        currentVDOM,
        currentSelection,
        ' BOLD',
        currentToggleState,
      );
      currentVDOM = insertResult.newVDOM;
      currentSelection = insertResult.newSelection;

      // Should have created bold text
      expect(currentVDOM).toContainEqual(
        expect.objectContaining({
          type: 'strong',
          children: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              content: ' BOLD',
            }),
          ]),
        }),
      );

      // Step 4: After text insertion, FSM recalculates toggle state based on new cursor position
      currentToggleState = {
        bold: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'bold'),
        italic: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'italic'),
        underline: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'underline'),
      };
      expect(currentToggleState.bold).toBe('active'); // Cursor is now after bold text

      // Step 5: User moves cursor to different position
      currentSelection = { start: { offset: 2 }, end: { offset: 2 }, isCollapsed: true };

      // Step 6: FSM recalculates toggle state based on new cursor position
      currentToggleState = {
        bold: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'bold'),
        italic: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'italic'),
        underline: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'underline'),
      };
      expect(currentToggleState.bold).toBe('inactive'); // Cursor is in plain text area
    });

    test('should demonstrate toggle state behavior during multiple toggles without cursor movement', () => {
      const currentVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Test text',
        },
      ];
      const currentSelection = { start: { offset: 4 }, end: { offset: 4 }, isCollapsed: true };

      // Initial state should be based on cursor position (plain text)
      let currentToggleState: FormatToggleState = {
        bold: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'bold'),
        italic: 'inactive',
        underline: 'inactive',
      };
      expect(currentToggleState.bold).toBe('inactive');

      // First toggle: inactive -> active
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('active');

      // Second toggle: active -> inactive
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('inactive');

      // Third toggle: inactive -> active
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('active');

      // Cursor position should remain unchanged throughout
      expect(currentSelection.start.offset).toBe(4);
    });

    test('should demonstrate user expectation flow: toggle bold in plain text, type, continue typing bold', () => {
      // This test demonstrates the flow you described in the requirements
      let currentVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Plain text here',
        },
      ];

      // 1. Place cursor next to plain text
      let currentSelection = { start: { offset: 6 }, end: { offset: 6 }, isCollapsed: true }; // After "Plain "

      // Toggle state based on cursor position should be "inactive"
      let currentToggleState: FormatToggleState = {
        bold: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'bold'),
        italic: 'inactive',
        underline: 'inactive',
      };
      expect(currentToggleState.bold).toBe('inactive');

      // 2. User toggles to "active", now decoupled from cursor position
      currentToggleState = {
        ...currentToggleState,
        bold: currentToggleState.bold === 'active' ? 'inactive' : 'active',
      };
      expect(currentToggleState.bold).toBe('active');

      // 3. User types a character, bold is applied
      const insertResult = insertTextWithFormatting(
        currentVDOM,
        currentSelection,
        'BOLD',
        currentToggleState,
      );
      currentVDOM = insertResult.newVDOM;
      currentSelection = insertResult.newSelection; // Cursor now to the right of new character

      // Check that bold text was inserted
      expect(currentVDOM).toContainEqual(
        expect.objectContaining({
          type: 'strong',
          children: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              content: 'BOLD',
            }),
          ]),
        }),
      );

      // 4. Recalculate toggle state based on new cursor position
      // Cursor is now to the right of the bold text that was just typed
      currentToggleState = {
        bold: getFormatStateAtCursorPosition(currentVDOM, currentSelection, 'bold'),
        italic: 'inactive',
        underline: 'inactive',
      };
      expect(currentToggleState.bold).toBe('active'); // Should be active since cursor is after bold text

      // 5. User continues typing - should continue to be bold without additional toggles
      const secondInsertResult = insertTextWithFormatting(
        currentVDOM,
        currentSelection,
        ' MORE',
        currentToggleState,
      );

      // Should extend the bold formatting
      expect(secondInsertResult.newVDOM).toContainEqual(
        expect.objectContaining({
          type: 'strong',
          children: expect.arrayContaining([
            expect.objectContaining({
              type: 'text',
              content: expect.stringContaining('BOLD MORE'),
            }),
          ]),
        }),
      );
    });
  });
});
