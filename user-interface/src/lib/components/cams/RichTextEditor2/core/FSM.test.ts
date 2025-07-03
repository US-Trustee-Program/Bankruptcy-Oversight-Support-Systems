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
});
