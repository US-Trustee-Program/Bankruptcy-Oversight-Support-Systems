import { describe, test, expect, vi, beforeEach } from 'vitest';
import { FSM } from './FSM';
import { EditorCommand, EditorState, VDOMSelection } from './types';

describe('FSM with Selection Handling', () => {
  let fsm: FSM;
  let defaultState: EditorState;

  beforeEach(() => {
    vi.restoreAllMocks();

    fsm = new FSM();

    // Create a default state for testing
    const defaultSelection: VDOMSelection = {
      start: { offset: 3 },
      end: { offset: 3 },
      isCollapsed: true,
    };

    defaultState = {
      vdom: [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello',
        },
      ],
      selection: defaultSelection,
      canUndo: false,
      canRedo: false,
      formatToggleState: {
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      },
    };
  });

  test('should preserve selection state when content does not change', () => {
    const command: EditorCommand = { type: 'MOVE_CURSOR_UP' };

    const result = fsm.processCommand(command, defaultState);

    expect(result.didChange).toBe(false);
    expect(result.newSelection).toEqual(defaultState.selection);
  });

  test('should update selection when cursor position changes', () => {
    // Set cursor at position 2
    const command: EditorCommand = {
      type: 'SET_CURSOR_POSITION',
      payload: 2,
    };

    const result = fsm.processCommand(command, defaultState);

    // Selection should be updated to reflect new cursor position
    expect(result.newSelection).not.toEqual(defaultState.selection);

    // The FSM might create a new selection based on cursor position,
    // but the exact implementation depends on internal logic
    // For now, we just verify it's different from the original
  });

  test('should update selection when inserting text', () => {
    // Insert text at the current cursor position
    const command: EditorCommand = {
      type: 'INSERT_TEXT',
      payload: ' world',
    };

    const result = fsm.processCommand(command, defaultState);

    expect(result.didChange).toBe(true);

    // Selection should be updated to position after the inserted text
    expect(result.newSelection).not.toEqual(defaultState.selection);
  });

  describe('TOGGLE_BOLD command processing', () => {
    test('should apply bold formatting to plain text', () => {
      // Arrange
      const state: EditorState = {
        vdom: [
          {
            id: 'text-1',
            type: 'text',
            content: 'Hello world',
          },
        ],
        selection: {
          start: { offset: 0 },
          end: { offset: 11 },
          isCollapsed: false,
        },
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };
      const command: EditorCommand = { type: 'TOGGLE_BOLD' };

      // Act
      const result = fsm.processCommand(command, state);

      // Assert
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].type).toBe('strong');
      expect(result.newVDOM[0].children).toHaveLength(1);
      expect(result.newVDOM[0].children![0].content).toBe('Hello world');
    });

    test('should remove bold formatting from bold text', () => {
      // Arrange
      const state: EditorState = {
        vdom: [
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
        ],
        selection: {
          start: { offset: 0 },
          end: { offset: 9 },
          isCollapsed: false,
        },
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };
      const command: EditorCommand = { type: 'TOGGLE_BOLD' };

      // Act
      const result = fsm.processCommand(command, state);

      // Assert
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].type).toBe('text');
      expect(result.newVDOM[0].content).toBe('Bold text');
      expect(result.newVDOM[0].children).toBeUndefined();
    });

    test('should preserve selection after bold toggle', () => {
      // Arrange
      const originalSelection = {
        start: { offset: 0 },
        end: { offset: 5 },
        isCollapsed: false,
      };
      const state: EditorState = {
        vdom: [
          {
            id: 'text-1',
            type: 'text',
            content: 'Hello',
          },
        ],
        selection: originalSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };
      const command: EditorCommand = { type: 'TOGGLE_BOLD' };

      // Act
      const result = fsm.processCommand(command, state);

      // Assert
      expect(result.newSelection).toEqual(originalSelection);
    });

    test('should handle collapsed selection on plain text', () => {
      // Arrange
      const state: EditorState = {
        vdom: [
          {
            id: 'text-1',
            type: 'text',
            content: 'Hello',
          },
        ],
        selection: {
          start: { offset: 2 },
          end: { offset: 2 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };
      const command: EditorCommand = { type: 'TOGGLE_BOLD' };

      // Act
      const result = fsm.processCommand(command, state);

      // Assert
      // For collapsed selections, we should only update toggle state, not the VDOM
      expect(result.didChange).toBe(false);
      expect(result.newVDOM).toEqual(state.vdom); // VDOM should be unchanged
      expect(result.formatToggleState).toBeDefined();
      expect(result.formatToggleState!.bold).toBe('active'); // Toggle state should be updated
      expect(result.newSelection).toEqual(state.selection); // Selection should be unchanged
    });

    test('should handle empty VDOM gracefully', () => {
      // Arrange
      const state: EditorState = {
        vdom: [],
        selection: {
          start: { offset: 0 },
          end: { offset: 0 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };
      const command: EditorCommand = { type: 'TOGGLE_BOLD' };

      // Act
      const result = fsm.processCommand(command, state);

      // Assert
      expect(result.didChange).toBe(false);
      expect(result.newVDOM).toEqual([]);
    });
  });
});
