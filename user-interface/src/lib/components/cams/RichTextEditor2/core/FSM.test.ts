import { describe, beforeEach, test, expect, vi } from 'vitest';
import { FSM } from './FSM';
import { EditorState, VDOMNode, VDOMSelection } from './types';
import * as VDOMSelectionModule from './model/VDOMSelection';

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

  describe('Slice 3: handleBackspace', () => {
    test('handleBackspace should delete single character in middle of text', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup initial selection at position 5 (after "Hello")
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
      const result = fsm.processCommand({ type: 'BACKSPACE' }, currentState);

      // Verify the character was deleted and cursor moved back
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
      expect(result.newVDOM[0].content).toBe('Hell World'); // 'o' should be deleted
      expect(result.newSelection.start.offset).toBe(4);
      expect(result.newSelection.end.offset).toBe(4);
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('handleBackspace at start of text node should not delete when at document start', () => {
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
      const result = fsm.processCommand({ type: 'BACKSPACE' }, currentState);

      // Verify nothing was deleted at document start
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
      expect(result.newVDOM[0].content).toBe('Hello World'); // Content unchanged
      expect(result.newSelection.start.offset).toBe(0);
      expect(result.newSelection.end.offset).toBe(0);
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('handleBackspace at start of second text node should delete from end of first node', () => {
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

      // Setup initial selection at start of second text node
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
      const result = fsm.processCommand({ type: 'BACKSPACE' }, currentState);

      // Verify the last character of first node was deleted
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);

      // After deletion, the cleanup process should merge adjacent text nodes
      // So we expect "First" -> "Firs" + "Second" = "FirsSecond"
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].content).toBe('FirsSecond'); // 't' deleted and nodes merged

      // Cursor should be positioned at end of "Firs" (position 4)
      expect(result.newSelection.start.offset).toBe(4);
      expect(result.newSelection.end.offset).toBe(4);
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('handleBackspace should handle zero-width space replacement', () => {
      // Setup VDOM with zero-width space content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: '\u200B', // Zero-width space
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup initial selection at position 1 (after zero-width space)
      const initialSelection: VDOMSelection = {
        start: { node: textNode, offset: 1 },
        end: { node: textNode, offset: 1 },
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
      const result = fsm.processCommand({ type: 'BACKSPACE' }, currentState);

      // Verify the zero-width space was handled properly
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
      expect(result.newSelection.start.offset).toBe(0);
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('handleBackspace with range selection should delete selected content', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup range selection (select "llo W")
      const rangeSelection: VDOMSelection = {
        start: { node: textNode, offset: 2 },
        end: { node: textNode, offset: 7 },
        isCollapsed: false,
      };

      const currentState: EditorState = {
        vdom,
        selection: rangeSelection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'BACKSPACE' }, currentState);

      // Verify the selected content was deleted
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
      expect(result.newVDOM[0].content).toBe('Heorld'); // "llo W" should be deleted
      expect(result.newSelection.start.offset).toBe(2);
      expect(result.newSelection.end.offset).toBe(2);
      expect(result.newSelection.isCollapsed).toBe(true);
    });
  });

  describe('Slice 4: handleInsertText', () => {
    test('should insert text and update selection in plain text node', () => {
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];
      const selection: VDOMSelection = {
        start: { node: textNode, offset: 5 },
        end: { node: textNode, offset: 5 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' there' }, currentState);

      expect(result.newVDOM[0].content).toBe('Hello there World');
      expect(result.newSelection.start.node).toBe(result.newVDOM[0]); // Should refer to the new node in the VDOM
      expect(result.newSelection.start.offset).toBe(11);
      expect(result.newSelection.end.offset).toBe(11);
      expect(result.newSelection.isCollapsed).toBe(true);
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
    });

    test('should insert text with preserved formatting in bold section', () => {
      const textNode: VDOMNode = {
        type: 'text',
        path: [0, 0],
        content: 'bold text',
      };

      const boldNode: VDOMNode = {
        type: 'strong',
        path: [0],
        children: [textNode],
      };

      const vdom: VDOMNode[] = [boldNode];
      const selection: VDOMSelection = {
        start: { node: textNode, offset: 4 },
        end: { node: textNode, offset: 4 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'active',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' very' }, currentState);

      // Verify text was inserted and remained bold
      expect(result.newVDOM[0].type).toBe('strong');
      expect((result.newVDOM[0] as VDOMNode).children![0].content).toBe('bold very text');
      expect(result.newSelection.start.node).toBe((result.newVDOM[0] as VDOMNode).children![0]); // Should refer to the new text node within the bold container
      expect(result.newSelection.start.offset).toBe(9);
      expect(result.newSelection.end.offset).toBe(9);
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
    });

    test('should use getFormattingAtSelection to determine formatting for inserted text', () => {
      // Setup a spy on getFormattingAtSelection
      const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');

      // Mock return value for getFormattingAtSelection
      getFormattingSpy.mockReturnValue({
        bold: 'active',
        italic: 'inactive',
        underline: 'inactive',
      });

      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup selection
      const selection: VDOMSelection = {
        start: { node: textNode, offset: 5 },
        end: { node: textNode, offset: 5 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'INSERT_TEXT', payload: ' there' }, currentState);

      // Verify getFormattingAtSelection was called with correct arguments
      expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);

      // Verify the result has the correct formatting
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
    });
  });

  describe('Slice 5: handleToggleBold', () => {
    test('should use getFormattingAtSelection to determine toggle action for collapsed selection', () => {
      // Setup a spy on getFormattingAtSelection
      const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');

      // Mock return value for getFormattingAtSelection
      getFormattingSpy.mockReturnValue({
        bold: 'inactive',
        italic: 'inactive',
        underline: 'inactive',
      });

      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup collapsed selection (cursor)
      const selection: VDOMSelection = {
        start: { node: textNode, offset: 5 },
        end: { node: textNode, offset: 5 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'TOGGLE_BOLD' }, currentState);

      // Verify getFormattingAtSelection was called with correct arguments
      expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);

      // Verify the toggle state was updated correctly (inactive -> active)
      expect(result.formatToggleState?.bold).toBe('active');

      // Verify VDOM was not changed for collapsed selection
      expect(result.newVDOM).toBe(vdom);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);

      // Restore the spy
      getFormattingSpy.mockRestore();
    });

    test('should toggle formatToggleState from active to inactive for collapsed selection', () => {
      // Setup a spy on getFormattingAtSelection
      const getFormattingSpy = vi.spyOn(VDOMSelectionModule, 'getFormattingAtSelection');

      // Mock return value for getFormattingAtSelection - bold is active
      getFormattingSpy.mockReturnValue({
        bold: 'active',
        italic: 'inactive',
        underline: 'inactive',
      });

      // Setup VDOM with text in a strong node
      const textNode: VDOMNode = {
        type: 'text',
        path: [0, 0],
        content: 'Bold Text',
      };

      const strongNode: VDOMNode = {
        type: 'strong',
        path: [0],
        children: [textNode],
      };

      const vdom: VDOMNode[] = [strongNode];

      // Setup collapsed selection (cursor)
      const selection: VDOMSelection = {
        start: { node: textNode, offset: 5 },
        end: { node: textNode, offset: 5 },
        isCollapsed: true,
      };

      const currentState: EditorState = {
        vdom,
        selection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'TOGGLE_BOLD' }, currentState);

      // Verify getFormattingAtSelection was called
      expect(getFormattingSpy).toHaveBeenCalledWith(vdom, selection);

      // Verify the toggle state was updated correctly (active -> inactive)
      expect(result.formatToggleState?.bold).toBe('inactive');

      // Verify VDOM was not changed for collapsed selection
      expect(result.newVDOM).toBe(vdom);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);

      // Restore the spy
      getFormattingSpy.mockRestore();
    });

    test('should cancel pending toggle state when toggled twice', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup collapsed selection (cursor)
      const selection: VDOMSelection = {
        start: { node: textNode, offset: 5 },
        end: { node: textNode, offset: 5 },
        isCollapsed: true,
      };

      // Start with an active toggle state
      const currentState: EditorState = {
        vdom,
        selection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'active', // Already toggled on
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'TOGGLE_BOLD' }, currentState);

      // Verify the toggle state was reset to inactive
      expect(result.formatToggleState?.bold).toBe('inactive');

      // Verify VDOM was not changed
      expect(result.newVDOM).toBe(vdom);
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
    });

    test('should apply bold formatting to range selection', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0],
        content: 'Hello World',
      };

      const vdom: VDOMNode[] = [textNode];

      // Setup range selection
      const selection: VDOMSelection = {
        start: { node: textNode, offset: 0 },
        end: { node: textNode, offset: 5 },
        isCollapsed: false,
      };

      const currentState: EditorState = {
        vdom,
        selection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'TOGGLE_BOLD' }, currentState);

      // Verify VDOM was changed - first node should now be a strong node
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
      expect(result.newVDOM[0].type).toBe('strong');

      // Verify no formatToggleState was returned for range selection
      expect(result.formatToggleState).toBeUndefined();
    });

    test('should remove bold formatting from range selection inside strong node', () => {
      // Setup VDOM with text in a strong node
      const textNode: VDOMNode = {
        type: 'text',
        path: [0, 0],
        content: 'Bold Text',
      };

      const strongNode: VDOMNode = {
        type: 'strong',
        path: [0],
        children: [textNode],
      };

      const vdom: VDOMNode[] = [strongNode];

      // Setup range selection
      const selection: VDOMSelection = {
        start: { node: textNode, offset: 0 },
        end: { node: textNode, offset: 9 },
        isCollapsed: false,
      };

      const currentState: EditorState = {
        vdom,
        selection,
        canUndo: false,
        canRedo: false,
        formatToggleState: {
          bold: 'inactive',
          italic: 'inactive',
          underline: 'inactive',
        },
      };

      // Execute the command
      const result = fsm.processCommand({ type: 'TOGGLE_BOLD' }, currentState);

      // Verify VDOM was changed - strong node should be unwrapped
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);
      expect(result.newVDOM[0].type).toBe('text');
      expect(result.newVDOM[0].content).toBe('Bold Text');

      // Verify no formatToggleState was returned for range selection
      expect(result.formatToggleState).toBeUndefined();
    });
  });
});
