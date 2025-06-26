import { describe, test, expect, beforeEach } from 'vitest';
import { VNodeType, TextNode } from './VNode';
import { createTextNode, createElementNode, resetNodeIdCounter } from './VNodeFactory';
import { VirtualDOMTree } from './VirtualDOMTree';
import { insertNode, removeNode } from './VirtualDOMOperations';
import { EditorStateMachine, EditorState, EditorEvent } from '../StateMachine';

describe('Virtual DOM Integration', () => {
  let tree: VirtualDOMTree;
  let stateMachine: EditorStateMachine;

  beforeEach(() => {
    resetNodeIdCounter();
    tree = new VirtualDOMTree();
    stateMachine = new EditorStateMachine();
  });

  describe('State Machine + Virtual DOM', () => {
    test('should maintain virtual DOM state during editor state transitions', () => {
      // Create initial document structure
      const root = tree.getRoot();
      const paragraph = createElementNode('p');
      const textNode = createTextNode('Hello World');

      insertNode(root, paragraph);
      insertNode(paragraph, textNode);

      // Initial state should be IDLE
      expect(stateMachine.getCurrentState()).toBe(EditorState.IDLE);
      expect(tree.getTextContent()).toBe('Hello World');

      // Transition to TYPING state
      stateMachine.dispatch(EditorEvent.INPUT);
      expect(stateMachine.getCurrentState()).toBe(EditorState.TYPING);

      // Virtual DOM should remain intact
      expect(tree.getTextContent()).toBe('Hello World');
      expect(tree.findNodesByType(VNodeType.TEXT)).toHaveLength(1);
      expect(tree.findNodesByType(VNodeType.ELEMENT)).toHaveLength(1);
    });

    test('should handle virtual DOM operations in different editor states', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p');
      insertNode(root, paragraph);

      // IDLE state - should allow basic operations
      expect(stateMachine.getCurrentState()).toBe(EditorState.IDLE);
      const textNode = createTextNode('Initial text');
      insertNode(paragraph, textNode);
      expect(tree.getTextContent()).toBe('Initial text');

      // TYPING state - simulate text editing
      stateMachine.dispatch(EditorEvent.INPUT);
      expect(stateMachine.getCurrentState()).toBe(EditorState.TYPING);

      // Add more text nodes (simulating typing)
      const moreText = createTextNode(' and more text');
      insertNode(paragraph, moreText);
      expect(tree.getTextContent()).toBe('Initial text and more text');

      // SELECTING state - simulate text selection
      stateMachine.dispatch(EditorEvent.SELECTION_CHANGE);
      expect(stateMachine.getCurrentState()).toBe(EditorState.SELECTING);

      // Virtual DOM should still be accessible
      expect(tree.findNodesByType(VNodeType.TEXT)).toHaveLength(2);
    });

    test('should maintain tree integrity across state transitions', () => {
      const root = tree.getRoot();

      // Build a complex tree structure
      const para1 = createElementNode('p');
      const para2 = createElementNode('p');
      const text1 = createTextNode('First paragraph');
      const text2 = createTextNode('Second paragraph');

      insertNode(root, para1);
      insertNode(root, para2);
      insertNode(para1, text1);
      insertNode(para2, text2);

      // Validate initial structure
      expect(tree.validateTree()).toBe(true);
      expect(tree.getTextContent()).toBe('First paragraphSecond paragraph');

      // Transition through various states
      stateMachine.dispatch(EditorEvent.INPUT);
      stateMachine.dispatch(EditorEvent.SELECTION_CHANGE);
      stateMachine.dispatch(EditorEvent.FORMAT);
      stateMachine.dispatch(EditorEvent.FORMAT_COMPLETE);

      // Tree should remain valid throughout
      expect(tree.validateTree()).toBe(true);
      expect(tree.getTextContent()).toBe('First paragraphSecond paragraph');
      expect(root.children).toHaveLength(2);
    });

    test('should support undo/redo scenarios with virtual DOM snapshots', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p');
      const originalText = createTextNode('Original text');

      insertNode(root, paragraph);
      insertNode(paragraph, originalText);

      // Create snapshot of current state
      const snapshot1 = tree.cloneTree();
      expect(snapshot1.getTextContent()).toBe('Original text');

      // Make changes (simulating user editing)
      stateMachine.dispatch(EditorEvent.INPUT);
      const newText = createTextNode(' - edited');
      insertNode(paragraph, newText);
      expect(tree.getTextContent()).toBe('Original text - edited');

      // Create another snapshot
      const snapshot2 = tree.cloneTree();
      expect(snapshot2.getTextContent()).toBe('Original text - edited');

      // Verify snapshots are independent
      removeNode(newText);
      expect(tree.getTextContent()).toBe('Original text');
      expect(snapshot1.getTextContent()).toBe('Original text');
      expect(snapshot2.getTextContent()).toBe('Original text - edited');
    });

    test('should handle formatting operations with state machine coordination', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p');
      const textNode = createTextNode('Text to format');

      insertNode(root, paragraph);
      insertNode(paragraph, textNode);

      // Start formatting operation
      stateMachine.dispatch(EditorEvent.KEYBOARD_SHORTCUT);
      expect(stateMachine.getCurrentState()).toBe(EditorState.FORMATTING);

      // Virtual DOM should be accessible for formatting
      const textNodes = tree.findNodesByType(VNodeType.TEXT);
      expect(textNodes).toHaveLength(1);
      expect((textNodes[0] as TextNode).content).toBe('Text to format');

      // Complete formatting
      stateMachine.dispatch(EditorEvent.FORMAT_COMPLETE);
      expect(stateMachine.getCurrentState()).toBe(EditorState.SELECTING);

      // Tree should remain valid after formatting
      expect(tree.validateTree()).toBe(true);
    });

    test('should maintain cursor position context during virtual DOM changes', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p');
      const text1 = createTextNode('Hello ');
      const text2 = createTextNode('World');

      insertNode(root, paragraph);
      insertNode(paragraph, text1);
      insertNode(paragraph, text2);

      // Simulate cursor position tracking
      const cursorNode = text1;

      // Find cursor position in tree
      const path = tree.getNodePath(cursorNode);
      expect(path).toEqual([root, paragraph, text1]);

      // Make changes while preserving cursor context
      stateMachine.dispatch(EditorEvent.INPUT);
      const insertedText = createTextNode('Beautiful ');
      insertNode(paragraph, insertedText, 1); // Insert between text1 and text2

      // Verify tree structure
      expect(tree.getTextContent()).toBe('Hello Beautiful World');
      expect(paragraph.children).toEqual([text1, insertedText, text2]);

      // Cursor context should still be valid
      expect(tree.getNodePath(cursorNode)).toEqual([root, paragraph, text1]);
      expect(cursorNode.content).toBe('Hello ');
    });

    test('should handle complex document operations with state coordination', () => {
      const root = tree.getRoot();

      // Create a document with multiple paragraphs
      const para1 = createElementNode('p');
      const para2 = createElementNode('p');
      const heading = createElementNode('h1');

      insertNode(root, heading);
      insertNode(root, para1);
      insertNode(root, para2);

      // Add content
      insertNode(heading, createTextNode('Document Title'));
      insertNode(para1, createTextNode('First paragraph content.'));
      insertNode(para2, createTextNode('Second paragraph content.'));

      // Verify initial structure
      expect(tree.validateTree()).toBe(true);
      expect(tree.findNodesByType(VNodeType.ELEMENT)).toHaveLength(3);
      expect(tree.findNodesByType(VNodeType.TEXT)).toHaveLength(3);

      // Simulate complex editing operations
      stateMachine.dispatch(EditorEvent.INPUT); // Start typing
      stateMachine.dispatch(EditorEvent.SELECTION_CHANGE); // Select text
      stateMachine.dispatch(EditorEvent.FORMAT); // Apply formatting

      // Remove a paragraph (simulating delete operation)
      removeNode(para2);

      // Verify final structure
      expect(tree.validateTree()).toBe(true);
      expect(tree.findNodesByType(VNodeType.ELEMENT)).toHaveLength(2);
      expect(tree.findNodesByType(VNodeType.TEXT)).toHaveLength(2);
      expect(tree.getTextContent()).toBe('Document TitleFirst paragraph content.');
    });
  });

  describe('Integration Edge Cases', () => {
    test('should handle empty document state', () => {
      expect(stateMachine.getCurrentState()).toBe(EditorState.IDLE);
      expect(tree.getTextContent()).toBe('');
      expect(tree.findNodesByType(VNodeType.TEXT)).toHaveLength(0);

      // State transitions should work even with empty document
      stateMachine.dispatch(EditorEvent.INPUT);
      expect(stateMachine.getCurrentState()).toBe(EditorState.TYPING);
    });

    test('should handle rapid state transitions with virtual DOM operations', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p');
      insertNode(root, paragraph);

      // Rapid state transitions
      for (let i = 0; i < 10; i++) {
        stateMachine.dispatch(EditorEvent.INPUT);
        stateMachine.dispatch(EditorEvent.SELECTION_CHANGE);

        // Add content during transitions
        const textNode = createTextNode(`Text ${i} `);
        insertNode(paragraph, textNode);
      }

      // Tree should remain valid
      expect(tree.validateTree()).toBe(true);
      expect(tree.findNodesByType(VNodeType.TEXT)).toHaveLength(10);
      expect(tree.getTextContent()).toContain('Text 0 Text 1 Text 2');
    });

    test('should handle state machine reset with virtual DOM cleanup', () => {
      const root = tree.getRoot();
      const paragraph = createElementNode('p');
      const textNode = createTextNode('Test content');

      insertNode(root, paragraph);
      insertNode(paragraph, textNode);

      // Transition to non-idle state
      stateMachine.dispatch(EditorEvent.INPUT);
      expect(stateMachine.getCurrentState()).toBe(EditorState.TYPING);

      // Reset state machine
      stateMachine.reset();
      expect(stateMachine.getCurrentState()).toBe(EditorState.IDLE);

      // Virtual DOM should still be accessible
      expect(tree.getTextContent()).toBe('Test content');
      expect(tree.validateTree()).toBe(true);
    });
  });
});
