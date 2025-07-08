import { test, expect, describe, beforeEach } from 'vitest';
import { FSM } from './FSM';
import { EditorState, VDOMNode } from './types';

describe('FSM.handleBackspace - Bug Fix Integration Tests', () => {
  let fsm: FSM;

  beforeEach(() => {
    fsm = new FSM();
  });

  describe('BACKSPACE at End of Formatted Text', () => {
    test('should preserve bold formatting when deleting last character of bold text', () => {
      // Scenario: "This is a test" with "test" bolded, cursor at end, BACKSPACE to delete 't'
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

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 14 }, // Cursor at the end (after "test")
          end: { offset: 14 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should preserve bold formatting and just remove the 't'
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(2);
      expect(result.newVDOM[0].content).toBe('This is a ');
      expect(result.newVDOM[1].type).toBe('strong');
      expect(result.newVDOM[1].children).toHaveLength(1);
      expect(result.newVDOM[1].children![0].content).toBe('tes');

      // Cursor should be at position 13 (after "tes")
      expect(result.newSelection.start.offset).toBe(13);
      expect(result.newSelection.end.offset).toBe(13);
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('should remove empty bold container when deleting last character', () => {
      // Scenario: "Hello X" with "X" bolded, BACKSPACE to delete the X
      const initialVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello ',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'X',
            },
          ],
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 7 }, // After the "X"
          end: { offset: 7 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should remove the empty strong container
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].type).toBe('text');
      expect(result.newVDOM[0].content).toBe('Hello ');

      // Cursor should be at position 6 (end of "Hello ")
      expect(result.newSelection.start.offset).toBe(6);
      expect(result.newSelection.isCollapsed).toBe(true);
    });

    test('should preserve italic formatting when deleting from within italic text', () => {
      const initialVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Start ',
        },
        {
          id: 'em-1',
          type: 'em',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'italic',
            },
          ],
        },
        {
          id: 'text-3',
          type: 'text',
          content: ' end',
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 8 }, // In the middle of "italic" (after "it")
          end: { offset: 8 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should preserve italic formatting and delete 't'
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(3);
      expect(result.newVDOM[1].type).toBe('em');
      expect(result.newVDOM[1].children![0].content).toBe('ialic');

      // Cursor should be at position 7 (after "i" in "italic")
      expect(result.newSelection.start.offset).toBe(7);
    });
  });

  describe('BACKSPACE at Formatting Boundaries', () => {
    test('should handle BACKSPACE at boundary between plain and formatted text', () => {
      // Scenario: "Hello world" with "world" bolded, cursor at start of "world", BACKSPACE
      const initialVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello ',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'world',
            },
          ],
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 6 }, // At the boundary (start of "world")
          end: { offset: 6 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should delete the space from the plain text
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(2);
      expect(result.newVDOM[0].content).toBe('Hello');
      expect(result.newVDOM[1].type).toBe('strong');
      expect(result.newVDOM[1].children![0].content).toBe('world');

      // Cursor should be at position 5 (end of "Hello")
      expect(result.newSelection.start.offset).toBe(5);
    });

    test('should handle BACKSPACE that merges adjacent text nodes', () => {
      // Scenario: "Hello" + bold("X") + "world", delete the X, should merge "Hello" and "world"
      const initialVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'X',
            },
          ],
        },
        {
          id: 'text-3',
          type: 'text',
          content: 'world',
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 6 }, // After the "X"
          end: { offset: 6 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should remove the X and merge adjacent text nodes
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].type).toBe('text');
      expect(result.newVDOM[0].content).toBe('Helloworld');

      // Cursor should be at position 5 (between "Hello" and "world")
      expect(result.newSelection.start.offset).toBe(5);
    });
  });

  describe('BACKSPACE with Multiple Formatting Types', () => {
    test('should handle BACKSPACE in document with bold and italic text', () => {
      // Scenario: "Start " + bold("bold") + " and " + italic("italic") + " end"
      // BACKSPACE from within the italic text
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
              content: 'bold',
            },
          ],
        },
        {
          id: 'text-3',
          type: 'text',
          content: ' and ',
        },
        {
          id: 'em-1',
          type: 'em',
          children: [
            {
              id: 'text-4',
              type: 'text',
              content: 'italic',
            },
          ],
        },
        {
          id: 'text-5',
          type: 'text',
          content: ' end',
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 19 }, // After "itali" in "italic"
          end: { offset: 19 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should preserve all formatting and just delete 'l' from "italic"
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(5);
      expect(result.newVDOM[1].type).toBe('strong');
      expect(result.newVDOM[1].children![0].content).toBe('bold');
      expect(result.newVDOM[3].type).toBe('em');
      expect(result.newVDOM[3].children![0].content).toBe('itaic');

      // Cursor should be at position 18 (after "ita" in "itaic")
      expect(result.newSelection.start.offset).toBe(18);
    });

    test('should handle BACKSPACE that removes entire formatted section between others', () => {
      // Scenario: "Keep " + bold("delete") + " keep", BACKSPACE all of "delete"
      const initialVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Keep ',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'X', // Single character for simplicity
            },
          ],
        },
        {
          id: 'text-3',
          type: 'text',
          content: ' keep',
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 6 }, // After the "X"
          end: { offset: 6 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should remove the strong container and merge adjacent text
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].type).toBe('text');
      expect(result.newVDOM[0].content).toBe('Keep  keep');

      // Cursor should be at position 5 (between "Keep" and " keep")
      expect(result.newSelection.start.offset).toBe(5);
    });
  });

  describe('BACKSPACE Edge Cases', () => {
    test('should handle BACKSPACE at beginning of document gracefully', () => {
      const initialVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello world',
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 0 }, // At the very beginning
          end: { offset: 0 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should not change anything when at document start
      expect(result.didChange).toBe(false);
      expect(result.newVDOM).toEqual(initialVDOM);
      expect(result.newSelection.start.offset).toBe(0);
    });

    test('should handle BACKSPACE in empty document gracefully', () => {
      const initialVDOM: VDOMNode[] = [];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 0 },
          end: { offset: 0 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should handle empty document gracefully
      expect(result.didChange).toBe(false);
      expect(result.newVDOM).toEqual([]);
    });

    test('should handle BACKSPACE with malformed selection data gracefully', () => {
      const initialVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello',
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 100 }, // Out of bounds
          end: { offset: 100 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should handle gracefully without throwing
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].type).toBe('text');
      expect(result.newVDOM[0].content).toBe('Hello');
      expect(result.didChange).toBe(false);
    });
  });

  describe('BACKSPACE with Nested Formatting', () => {
    test('should handle BACKSPACE in nested bold+italic formatting', () => {
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
              content: 'bold ',
            },
            {
              id: 'em-1',
              type: 'em',
              children: [
                {
                  id: 'text-3',
                  type: 'text',
                  content: 'nested',
                },
              ],
            },
            {
              id: 'text-4',
              type: 'text',
              content: ' more',
            },
          ],
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 15 }, // In the middle of "nested" (after "nest")
          end: { offset: 15 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should preserve nested formatting and delete 't' from "nested"
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(2);
      expect(result.newVDOM[1].type).toBe('strong');

      // Find the nested em element
      const strongChildren = result.newVDOM[1].children!;
      const emElement = strongChildren.find((child: VDOMNode) => child.type === 'em');
      expect(emElement).toBeDefined();
      expect(emElement!.children![0].content).toBe('nesed');

      // Cursor should be at position 14 (after "nes" in "nested")
      expect(result.newSelection.start.offset).toBe(14);
    });

    test('should remove empty nested container while preserving parent', () => {
      const initialVDOM: VDOMNode[] = [
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-1',
              type: 'text',
              content: 'bold ',
            },
            {
              id: 'em-1',
              type: 'em',
              children: [
                {
                  id: 'text-2',
                  type: 'text',
                  content: 'X', // Will be deleted
                },
              ],
            },
            {
              id: 'text-3',
              type: 'text',
              content: ' more',
            },
          ],
        },
      ];

      const initialState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 6 }, // After the "X"
          end: { offset: 6 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      const result = fsm.processCommand({ type: 'BACKSPACE' }, initialState);

      // Should remove the empty em container but keep the strong container
      expect(result.didChange).toBe(true);
      expect(result.newVDOM).toHaveLength(1);
      expect(result.newVDOM[0].type).toBe('strong');
      expect(result.newVDOM[0].children).toHaveLength(1);
      expect(result.newVDOM[0].children![0].content).toBe('bold  more');
    });
  });

  describe('BACKSPACE Performance and Consistency', () => {
    test('should maintain consistent cursor positioning after complex BACKSPACE operations', () => {
      // Test multiple BACKSPACE operations in sequence
      const initialVDOM: VDOMNode[] = [
        {
          id: 'text-1',
          type: 'text',
          content: 'Hello ',
        },
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-2',
              type: 'text',
              content: 'world',
            },
          ],
        },
      ];

      let currentState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 11 }, // End of document
          end: { offset: 11 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      // First BACKSPACE: delete 'd' from "world"
      let result = fsm.processCommand({ type: 'BACKSPACE' }, currentState);
      expect(result.newSelection.start.offset).toBe(10);
      expect(result.newVDOM[1].children![0].content).toBe('worl');

      // Second BACKSPACE: delete 'l' from "worl"
      currentState = {
        ...currentState,
        vdom: result.newVDOM,
        selection: result.newSelection,
      };
      result = fsm.processCommand({ type: 'BACKSPACE' }, currentState);
      expect(result.newSelection.start.offset).toBe(9);
      expect(result.newVDOM[1].children![0].content).toBe('wor');

      // Verify formatting is still preserved
      expect(result.newVDOM[1].type).toBe('strong');
    });

    test('should handle rapid BACKSPACE operations without losing formatting structure', () => {
      const initialVDOM: VDOMNode[] = [
        {
          id: 'strong-1',
          type: 'strong',
          children: [
            {
              id: 'text-1',
              type: 'text',
              content: 'testing',
            },
          ],
        },
      ];

      let currentState: EditorState = {
        vdom: initialVDOM,
        selection: {
          start: { offset: 7 }, // End of "testing"
          end: { offset: 7 },
          isCollapsed: true,
        },
        canUndo: false,
        canRedo: false,
      };

      // Simulate rapid BACKSPACE until only one character remains
      for (let i = 7; i > 1; i--) {
        const result = fsm.processCommand({ type: 'BACKSPACE' }, currentState);
        expect(result.didChange).toBe(true);
        expect(result.newVDOM[0].type).toBe('strong'); // Should preserve formatting

        currentState = {
          ...currentState,
          vdom: result.newVDOM,
          selection: result.newSelection,
        };
      }

      // Should still have strong formatting with one character
      expect(currentState.vdom[0].type).toBe('strong');
      expect(currentState.vdom[0].children![0].content).toBe('t');
    });
  });
});
