import { test, expect, beforeEach } from 'vitest';
import { FSM } from './FSM';
import { EditorState, VDOMNode } from './types';
import { getFormatStateAtCursorPosition } from './model/VDOMFormatting';

describe('FSM.handleInsertText - Bug Fix Integration Tests', () => {
  let fsm: FSM;

  beforeEach(() => {
    fsm = new FSM();
  });

  test('should preserve bold formatting and append text to formatted node when inserting at document end', () => {
    // This is the exact bug scenario: "This is a test" with "test" bolded,
    // cursor at position 15 (end of document), inserting a space
    const initialVDOM: VDOMNode[] = [
      {
        id: 'text-1',
        type: 'text',
        content: 'This is a ',
      },
      {
        id: 'strong-1',
        type: 'strong',
        children: [
          {
            id: 'text-2',
            type: 'text',
            content: 'test',
          },
        ],
      },
    ];

    const selection = {
      start: { offset: 14 }, // Cursor at the actual end of document
      end: { offset: 14 },
      isCollapsed: true,
    };

    // Determine the correct toggle state based on cursor position
    const boldState = getFormatStateAtCursorPosition(initialVDOM, selection, 'bold');

    const initialState: EditorState = {
      vdom: initialVDOM,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: { bold: boldState, italic: 'inactive', underline: 'inactive' },
    };

    // Insert a space at the end
    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' ' }, initialState);

    // The bug was that this would destroy the strong node and create:
    // [{id: 'text-...', type: 'text', content: 'This is a test '}]
    //
    // The fix should preserve the structure and append to the last text node:
    const expectedVDOM: VDOMNode[] = [
      {
        id: 'text-1',
        type: 'text',
        content: 'This is a ',
      },
      {
        id: 'strong-1',
        type: 'strong',
        children: [
          {
            id: 'text-2',
            type: 'text',
            content: 'test ',
          },
        ],
      },
    ];

    expect(result.didChange).toBe(true);
    expect(result.newVDOM).toHaveLength(2);
    expect(result.newVDOM[0]).toEqual(expectedVDOM[0]);
    expect(result.newVDOM[1].type).toBe('strong');
    expect(result.newVDOM[1].children).toHaveLength(1);
    expect(result.newVDOM[1].children![0].content).toBe('test ');

    // Cursor should be at position 15 (after the inserted space)
    expect(result.newSelection.start.offset).toBe(15);
    expect(result.newSelection.end.offset).toBe(15);
    expect(result.newSelection.isCollapsed).toBe(true);
  });

  test('should insert text into previous node when cursor is positioned exactly between two text nodes', () => {
    // Test inserting at the exact boundary between two text nodes
    const initialVDOM: VDOMNode[] = [
      {
        id: 'text-1',
        type: 'text',
        content: 'Hello ',
      },
      {
        id: 'text-2',
        type: 'text',
        content: 'World',
      },
    ];

    const selection = {
      start: { offset: 6 }, // Exactly at boundary between "Hello " and "World"
      end: { offset: 6 },
      isCollapsed: true,
    };

    // Determine the correct toggle state based on cursor position
    const boldState = getFormatStateAtCursorPosition(initialVDOM, selection, 'bold');

    const initialState: EditorState = {
      vdom: initialVDOM,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: { bold: boldState, italic: 'inactive', underline: 'inactive' },
    };

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: 'Big ' }, initialState);

    expect(result.didChange).toBe(true);

    // Should insert into the first text node since we favor previous node at boundaries
    expect(result.newVDOM).toHaveLength(2);
    expect(result.newVDOM[0].content).toBe('Hello Big ');
    expect(result.newVDOM[1].content).toBe('World');

    // Cursor should be at position 10 (after "Hello Big ")
    expect(result.newSelection.start.offset).toBe(10);
  });

  test('should insert text within formatting container when cursor is positioned inside formatted text', () => {
    const initialVDOM: VDOMNode[] = [
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
            content: 'bold text',
          },
        ],
      },
      {
        id: 'text-3',
        type: 'text',
        content: ' end',
      },
    ];

    const selection = {
      start: { offset: 11 }, // After "bold " in the formatted text
      end: { offset: 11 },
      isCollapsed: true,
    };

    // Determine the correct toggle state based on cursor position
    const boldState = getFormatStateAtCursorPosition(initialVDOM, selection, 'bold');

    const initialState: EditorState = {
      vdom: initialVDOM,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: { bold: boldState, italic: 'inactive', underline: 'inactive' },
    };

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: 'very ' }, initialState);

    expect(result.didChange).toBe(true);
    expect(result.newVDOM).toHaveLength(3);

    // Should preserve the structure and insert into the bold text
    expect(result.newVDOM[0].content).toBe('Start ');
    expect(result.newVDOM[1].type).toBe('strong');
    expect(result.newVDOM[1].children![0].content).toBe('bold very text');
    expect(result.newVDOM[2].content).toBe(' end');
  });

  test('should continue processing text insertion when position conversion encounters malformed data', () => {
    // Create a malformed VDOM that might cause conversion issues
    const initialVDOM: VDOMNode[] = [
      {
        id: 'text-1',
        type: 'text',
        // Missing content property
      } as VDOMNode,
    ];

    const selection = {
      start: { offset: 0 },
      end: { offset: 0 },
      isCollapsed: true,
    };

    // Determine the correct toggle state based on cursor position
    const boldState = getFormatStateAtCursorPosition(initialVDOM, selection, 'bold');

    const initialState: EditorState = {
      vdom: initialVDOM,
      selection,
      canUndo: false,
      canRedo: false,
      formatToggleState: { bold: boldState, italic: 'inactive', underline: 'inactive' },
    };

    const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: 'test' }, initialState);

    // Should still work (either through successful conversion or fallback)
    expect(result.didChange).toBe(true);
    expect(result.newVDOM).toBeDefined();
    expect(result.newSelection).toBeDefined();
  });
});
