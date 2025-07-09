import { describe, beforeEach, test, expect } from 'vitest';
import { FSM } from './FSM';
import { EditorState, VDOMNode, VDOMSelection } from './types';

describe('FSM', () => {
  let fsm: FSM;

  beforeEach(() => {
    fsm = new FSM();
  });

  describe('Slice 2: handleMoveCursorLeft/Right', () => {
    test('handleMoveCursorLeft should move cursor left by one position', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup initial selection at position 5 (middle of "Hello World")
      const initialSelection: VDOMSelection = {
        start: { node: textNode, offset: 5 },
        end: { node: textNode, offset: 5 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_LEFT' }, currentState);

      // Verify the cursor moved left by one position
      expect(result.newSelection.start.offset).toBe(4);
      expect(result.newSelection.end.offset).toBe(4);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    test('handleMoveCursorRight should move cursor right by one position', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup initial selection at position 5 (middle of "Hello World")
      const initialSelection: VDOMSelection = {
        start: { node: textNode, offset: 5 },
        end: { node: textNode, offset: 5 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_RIGHT' }, currentState);

      // Verify the cursor moved right by one position
      expect(result.newSelection.start.offset).toBe(6);
      expect(result.newSelection.end.offset).toBe(6);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    test('handleMoveCursorLeft at start of document should not move', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup initial selection at position 0 (start of text)
      const initialSelection: VDOMSelection = {
        start: { node: textNode, offset: 0 },
        end: { node: textNode, offset: 0 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_LEFT' }, currentState);

      // Verify the cursor stayed at position 0
      expect(result.newSelection.start.offset).toBe(0);
      expect(result.newSelection.end.offset).toBe(0);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    test('handleMoveCursorRight at end of text should not move beyond', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup initial selection at end of text (position 11)
      const initialSelection: VDOMSelection = {
        start: { node: textNode, offset: 11 },
        end: { node: textNode, offset: 11 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_RIGHT' }, currentState);

      // Verify the cursor stayed at the end position
      expect(result.newSelection.start.offset).toBe(11);
      expect(result.newSelection.end.offset).toBe(11);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    // Tests for cross-node navigation
    test('handleMoveCursorLeft at start of second text node should move to end of first text node', () => {
      // Setup VDOM with multiple text nodes
      const firstTextNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'First',
      };

      const secondTextNode: VDOMNode = {
        type: 'text',
        path: [1],
        content: 'Second',
      };

      const vdom: VDOMNode[] = [firstTextNode, secondTextNode];

      // Setup initial selection at start of second text node (position 0)
      const initialSelection: VDOMSelection = {
        start: { node: secondTextNode, offset: 0 },
        end: { node: secondTextNode, offset: 0 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_LEFT' }, currentState);

      // Verify the cursor moved to end of first text node
      expect(result.newSelection.start.node).toBe(firstTextNode);
      expect(result.newSelection.start.offset).toBe(5); // End of "First"
      expect(result.newSelection.end.node).toBe(firstTextNode);
      expect(result.newSelection.end.offset).toBe(5);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    test('handleMoveCursorRight at end of first text node should move to start of second text node', () => {
      // Setup VDOM with multiple text nodes
      const firstTextNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'First',
      };

      const secondTextNode: VDOMNode = {
        type: 'text',
        path: [1],
        content: 'Second',
      };

      const vdom: VDOMNode[] = [firstTextNode, secondTextNode];

      // Setup initial selection at end of first text node (position 5)
      const initialSelection: VDOMSelection = {
        start: { node: firstTextNode, offset: 5 },
        end: { node: firstTextNode, offset: 5 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_RIGHT' }, currentState);

      // Verify the cursor moved to start of second text node
      expect(result.newSelection.start.node).toBe(secondTextNode);
      expect(result.newSelection.start.offset).toBe(0);
      expect(result.newSelection.end.node).toBe(secondTextNode);
      expect(result.newSelection.end.offset).toBe(0);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    test('handleMoveCursorLeft at start of first text node should not move', () => {
      // Setup VDOM with multiple text nodes
      const firstTextNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'First',
      };

      const secondTextNode: VDOMNode = {
        type: 'text',
        path: [1],
        content: 'Second',
      };

      const vdom: VDOMNode[] = [firstTextNode, secondTextNode];

      // Setup initial selection at start of first text node (position 0)
      const initialSelection: VDOMSelection = {
        start: { node: firstTextNode, offset: 0 },
        end: { node: firstTextNode, offset: 0 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_LEFT' }, currentState);

      // Verify the cursor stayed at the start position
      expect(result.newSelection.start.node).toBe(firstTextNode);
      expect(result.newSelection.start.offset).toBe(0);
      expect(result.newSelection.end.node).toBe(firstTextNode);
      expect(result.newSelection.end.offset).toBe(0);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    test('handleMoveCursorRight at end of last text node should not move', () => {
      // Setup VDOM with multiple text nodes
      const firstTextNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'First',
      };

      const secondTextNode: VDOMNode = {
        type: 'text',
        path: [1],
        content: 'Second',
      };

      const vdom: VDOMNode[] = [firstTextNode, secondTextNode];

      // Setup initial selection at end of second text node (position 6)
      const initialSelection: VDOMSelection = {
        start: { node: secondTextNode, offset: 6 },
        end: { node: secondTextNode, offset: 6 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_RIGHT' }, currentState);

      // Verify the cursor stayed at the end position
      expect(result.newSelection.start.node).toBe(secondTextNode);
      expect(result.newSelection.start.offset).toBe(6);
      expect(result.newSelection.end.node).toBe(secondTextNode);
      expect(result.newSelection.end.offset).toBe(6);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    test('should handle complex nested structure with correct path ordering', () => {
      // Setup VDOM with nested structure like: paragraph -> [text1, strong -> text2, text3]
      const text1: VDOMNode = {
        type: 'text',
        path: [0, 0],
        content: 'Before ',
      };

      const text2: VDOMNode = {
        type: 'text',
        path: [0, 1, 0],
        content: 'bold',
      };

      const strongNode: VDOMNode = {
        type: 'strong',
        path: [0, 1],
        children: [text2],
      };

      const text3: VDOMNode = {
        type: 'text',
        path: [0, 2],
        content: ' after',
      };

      const paragraphNode: VDOMNode = {
        type: 'paragraph',
        path: [0],
        children: [text1, strongNode, text3],
      };

      const vdom: VDOMNode[] = [paragraphNode];

      // Test moving right from end of text1 to start of text2
      const initialSelection: VDOMSelection = {
        start: { node: text1, offset: 7 }, // End of "Before "
        end: { node: text1, offset: 7 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection: initialSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'MOVE_CURSOR_RIGHT' }, currentState);

      // Verify the cursor moved to start of text2 (inside strong)
      expect(result.newSelection.start.node).toBe(text2);
      expect(result.newSelection.start.offset).toBe(0);
      expect(result.newSelection.end.node).toBe(text2);
      expect(result.newSelection.end.offset).toBe(0);
      expect(result.newSelection.isCollapsed).toBe(true);
    });
  });
});
