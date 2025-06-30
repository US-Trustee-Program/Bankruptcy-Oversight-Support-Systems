import { describe, test, expect } from 'vitest';
import { insertText, deleteContentBackward } from './textMutations';
import { EditorState, SelectionState } from '../types';
import { RootNode, ElementNode, TextNode, VNodeType } from '../virtual-dom/VNode';

// --- Test Data Factory ---

const createInitialState = (): EditorState => {
  const textNode: TextNode = {
    id: 'text1',
    type: VNodeType.TEXT,
    parent: null, // Will be set by parent
    children: [],
    startOffset: 1,
    endOffset: 12,
    depth: 2,
    content: 'Hello World',
  };

  const pNode: ElementNode = {
    id: 'p1',
    type: VNodeType.ELEMENT,
    tagName: 'p',
    attributes: {},
    parent: null, // Will be set by root
    children: [textNode],
    startOffset: 0,
    endOffset: 13,
    depth: 1,
  };

  const rootNode: RootNode = {
    id: 'root',
    type: VNodeType.ROOT,
    parent: null,
    children: [pNode],
    startOffset: 0,
    endOffset: 13,
    depth: 0,
  };

  // Set parent references
  pNode.parent = rootNode;
  textNode.parent = pNode;

  const selection: SelectionState = {
    anchorNode: textNode,
    anchorOffset: 5, // Cursor after "Hello"
    focusNode: textNode,
    focusOffset: 5,
    isCollapsed: true,
  };

  return { vdom: rootNode, selection };
};

// --- Tests ---

describe('textMutations', () => {
  describe('insertText', () => {
    test('should insert text at the cursor position', () => {
      const initialState = createInitialState();
      const newState = insertText(initialState, '!');

      const newPara = newState.vdom.children[0] as ElementNode;
      const newText = newPara.children[0] as TextNode;

      expect(newText.content).toBe('Hello! World');
    });

    test('should return a new EditorState object (immutability)', () => {
      const initialState = createInitialState();
      const newState = insertText(initialState, '!');

      expect(newState).not.toBe(initialState);
      expect(newState.vdom).not.toBe(initialState.vdom);
    });

    test('should update the selection to be after the inserted text', () => {
      const initialState = createInitialState();
      const newState = insertText(initialState, '!');

      expect(newState.selection.isCollapsed).toBe(true);
      expect(newState.selection.anchorOffset).toBe(6);
      expect(newState.selection.focusOffset).toBe(6);
    });
  });

  describe('deleteContentBackward', () => {
    test('should delete one character before the cursor position', () => {
      const initialState = createInitialState();
      const newState = deleteContentBackward(initialState);

      const newPara = newState.vdom.children[0] as ElementNode;
      const newText = newPara.children[0] as TextNode;

      expect(newText.content).toBe('Hell World');
    });

    test('should return a new EditorState object (immutability)', () => {
      const initialState = createInitialState();
      const newState = deleteContentBackward(initialState);

      expect(newState).not.toBe(initialState);
      expect(newState.vdom).not.toBe(initialState.vdom);
    });

    test('should update the selection to be at the deletion point', () => {
      const initialState = createInitialState();
      const newState = deleteContentBackward(initialState);

      expect(newState.selection.isCollapsed).toBe(true);
      expect(newState.selection.anchorOffset).toBe(4);
      expect(newState.selection.focusOffset).toBe(4);
    });

    test('should do nothing if the cursor is at the beginning of a text node', () => {
      const initialState = createInitialState();
      initialState.selection.anchorOffset = 0;
      initialState.selection.focusOffset = 0;

      const newState = deleteContentBackward(initialState);
      expect(newState).toBe(initialState);
    });
  });
});
