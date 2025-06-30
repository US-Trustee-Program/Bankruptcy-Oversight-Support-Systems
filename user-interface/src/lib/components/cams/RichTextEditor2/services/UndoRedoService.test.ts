import { describe, test, expect, beforeEach } from 'vitest';
import { createUndoRedoService, UndoRedoService } from './UndoRedoService';
import { EditorState } from '../types';
import { RootNode, VNodeType, TextNode } from '../virtual-dom/VNode';

// Helper to create a mock VNode for selection state
const mockTextNode: TextNode = {
  id: 'mock-text',
  type: VNodeType.TEXT,
  parent: null,
  children: [],
  startOffset: 0,
  endOffset: 0,
  depth: 1,
  content: '',
};

// Helper to create a mock EditorState for testing
const createMockEditorState = (content: string): EditorState => ({
  vdom: {
    id: `root-${content}`,
    type: VNodeType.ROOT,
    parent: null,
    children: [],
    startOffset: 0,
    endOffset: content.length,
    depth: 0,
  } as RootNode,
  selection: {
    anchorNode: mockTextNode,
    anchorOffset: 0,
    focusNode: mockTextNode,
    focusOffset: 0,
    isCollapsed: true,
  },
});

describe('UndoRedoService', () => {
  let service: UndoRedoService;
  const initialState = createMockEditorState('initial');

  beforeEach(() => {
    service = createUndoRedoService(initialState);
  });

  test('should initialize with the initial state', () => {
    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(false);
  });

  test('should record a new state and allow undo', () => {
    const newState = createMockEditorState('state 1');
    service.record(newState);
    expect(service.canUndo()).toBe(true);
    expect(service.canRedo()).toBe(false);
  });

  test('undo should return the previous state', () => {
    const state1 = createMockEditorState('state 1');
    service.record(state1);

    const undoneState = service.undo();
    expect(undoneState).toBe(initialState);
    expect(service.canUndo()).toBe(false);
    expect(service.canRedo()).toBe(true);
  });

  test('redo should return the undone state', () => {
    const state1 = createMockEditorState('state 1');
    service.record(state1);
    service.undo();

    const redoneState = service.redo();
    expect(redoneState).toBe(state1);
    expect(service.canUndo()).toBe(true);
    expect(service.canRedo()).toBe(false);
  });

  test('recording a new state should clear the redo stack', () => {
    const state1 = createMockEditorState('state 1');
    const state2 = createMockEditorState('state 2');
    service.record(state1);
    service.undo();
    expect(service.canRedo()).toBe(true);

    service.record(state2);
    expect(service.canRedo()).toBe(false);
  });

  test('undo should return null when there is no history', () => {
    expect(service.undo()).toBeNull();
  });

  test('redo should return null when there is no future', () => {
    expect(service.redo()).toBeNull();
  });

  test('should handle multiple undo/redo operations correctly', () => {
    const state1 = createMockEditorState('state 1');
    const state2 = createMockEditorState('state 2');
    const state3 = createMockEditorState('state 3');

    service.record(state1);
    service.record(state2);
    service.record(state3);

    expect(service.canUndo()).toBe(true);
    expect(service.undo()).toBe(state2);
    expect(service.undo()).toBe(state1);
    expect(service.undo()).toBe(initialState);
    expect(service.undo()).toBeNull();

    expect(service.canRedo()).toBe(true);
    expect(service.redo()).toBe(state1);
    expect(service.redo()).toBe(state2);
    expect(service.redo()).toBe(state3);
    expect(service.redo()).toBeNull();
  });
});
