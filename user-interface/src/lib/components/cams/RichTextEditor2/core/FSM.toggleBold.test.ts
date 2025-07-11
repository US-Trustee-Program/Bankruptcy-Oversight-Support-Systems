import { describe, it, expect, beforeEach } from 'vitest';
import { FSM } from './FSM';
import { EditorState, VDOMNode, VDOMSelection } from './types';

describe('FSM handleToggleBold - Slice 5 Refactoring', () => {
  let fsm: FSM;

  beforeEach(() => {
    fsm = new FSM();
  });

  describe('Range selection formatting', () => {
    it('should wrap partial text selection in strong tag', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0, 0],
        content: 'Hello world',
      };

      const paragraphNode: VDOMNode = {
        type: 'paragraph',
        path: [0],
        children: [textNode],
      };

      const vdom: VDOMNode[] = [paragraphNode];

      // Setup range selection for "Hello" (0-5)
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

      // Verify the result
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);

      // The paragraph should now have two children:
      // 1. A strong node containing "Hello"
      // 2. A text node containing " world"
      const paragraph = result.newVDOM[0];
      expect(paragraph.children).toHaveLength(2);

      // First child should be strong node with "Hello"
      const strongNode = paragraph.children![0];
      expect(strongNode.type).toBe('strong');
      expect(strongNode.children).toHaveLength(1);
      expect(strongNode.children![0].type).toBe('text');
      expect(strongNode.children![0].content).toBe('Hello');

      // Second child should be text node with " world"
      const remainingText = paragraph.children![1];
      expect(remainingText.type).toBe('text');
      expect(remainingText.content).toBe(' world');
    });

    it('should remove bold from partial selection within strong node', () => {
      // Setup VDOM with text in a strong node
      const textNode: VDOMNode = {
        type: 'text',
        path: [0, 0, 0],
        content: 'Hello world',
      };

      const strongNode: VDOMNode = {
        type: 'strong',
        path: [0, 0],
        children: [textNode],
      };

      const paragraphNode: VDOMNode = {
        type: 'paragraph',
        path: [0],
        children: [strongNode],
      };

      const vdom: VDOMNode[] = [paragraphNode];

      // Setup range selection for "Hello" (0-5) within the strong node
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

      // Verify the result
      expect(result.didChange).toBe(true);
      expect(result.isPersistent).toBe(true);

      // The paragraph should now have two children:
      // 1. A text node containing "Hello" (unbold)
      // 2. A strong node containing " world" (still bold)
      const paragraph = result.newVDOM[0];
      expect(paragraph.children).toHaveLength(2);

      // First child should be regular text node with "Hello"
      const unBoldText = paragraph.children![0];
      expect(unBoldText.type).toBe('text');
      expect(unBoldText.content).toBe('Hello');

      // Second child should be strong node with " world"
      const remainingStrong = paragraph.children![1];
      expect(remainingStrong.type).toBe('strong');
      expect(remainingStrong.children).toHaveLength(1);
      expect(remainingStrong.children![0].type).toBe('text');
      expect(remainingStrong.children![0].content).toBe(' world');
    });
  });

  describe('Collapsed selection (cursor) formatting', () => {
    it('should toggle formatToggleState.bold for collapsed selection', () => {
      // Setup VDOM with text content
      const textNode: VDOMNode = {
        type: 'text',
        path: [0, 0],
        content: 'Hello world',
      };

      const paragraphNode: VDOMNode = {
        type: 'paragraph',
        path: [0],
        children: [textNode],
      };

      const vdom: VDOMNode[] = [paragraphNode];

      // Setup collapsed selection (cursor at position 5)
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

      // Verify the result
      expect(result.didChange).toBe(false);
      expect(result.isPersistent).toBe(false);
      expect(result.newVDOM).toBe(vdom); // No VDOM change

      // Verify the toggle state was updated
      expect(result.formatToggleState?.bold).toBe('active');
    });
  });
});
