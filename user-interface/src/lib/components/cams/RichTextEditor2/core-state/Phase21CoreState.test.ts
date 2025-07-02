/**
 * Phase 2.1 Core State Tests
 * Test suite for the foundational state management implementation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EditorState,
  Selection,
  createInitialEditorState,
  transitionEditorMode,
  updateSelection,
  updateVirtualDOM,
} from './EditorState';
import {
  UndoRedoService,
  CircularBufferUndoRedoService,
  createInsertTextOperation,
  createDeleteTextOperation,
} from './UndoRedoService';
import {
  PathBasedSelectionService,
  PathBasedSelectionServiceImpl,
  createCollapsedSelection,
  createRangeSelection,
  selectionsEqual,
} from './PathBasedSelectionService';
import {
  Phase21EditorCore,
  createPhase21EditorCore,
  createInitialParagraphVirtualDOM,
} from './Phase21EditorCore';
import { VNode } from '../virtual-dom/VNode';

describe('Phase 2.1 Core State Management', () => {
  describe('EditorState', () => {
    let mockVirtualDOM: VNode;
    let initialState: EditorState;

    beforeEach(() => {
      mockVirtualDOM = createInitialParagraphVirtualDOM();
      initialState = createInitialEditorState(mockVirtualDOM);
    });

    it('should create initial editor state with correct structure', () => {
      expect(initialState).toMatchObject({
        virtualDOM: mockVirtualDOM,
        selection: {
          startPath: [0],
          startOffset: 0,
          endPath: [0],
          endOffset: 0,
          isCollapsed: true,
        },
        currentEditorMode: 'IDLE',
      });
    });

    it('should transition editor mode immutably', () => {
      const newState = transitionEditorMode(initialState, 'TYPING');

      expect(newState.currentEditorMode).toBe('TYPING');
      expect(newState.virtualDOM).toBe(initialState.virtualDOM);
      expect(newState.selection).toBe(initialState.selection);
      expect(newState).not.toBe(initialState); // Different objects
    });

    it('should update selection immutably', () => {
      const newSelection: Selection = {
        startPath: [0, 0],
        startOffset: 5,
        endPath: [0, 0],
        endOffset: 5,
        isCollapsed: true,
      };

      const newState = updateSelection(initialState, newSelection);

      expect(newState.selection).toEqual(newSelection);
      expect(newState.virtualDOM).toBe(initialState.virtualDOM);
      expect(newState.currentEditorMode).toBe(initialState.currentEditorMode);
      expect(newState).not.toBe(initialState);
    });

    it('should update virtual DOM immutably', () => {
      const newVirtualDOM = { ...mockVirtualDOM, id: 'new-root' };
      const newState = updateVirtualDOM(initialState, newVirtualDOM);

      expect(newState.virtualDOM).toBe(newVirtualDOM);
      expect(newState.selection).toBe(initialState.selection);
      expect(newState.currentEditorMode).toBe(initialState.currentEditorMode);
      expect(newState).not.toBe(initialState);
    });
  });

  describe('Selection Management', () => {
    it('should create collapsed selection correctly', () => {
      const selection = createCollapsedSelection([0, 1, 2], 5);

      expect(selection).toEqual({
        startPath: [0, 1, 2],
        startOffset: 5,
        endPath: [0, 1, 2],
        endOffset: 5,
        isCollapsed: true,
      });
    });

    it('should create range selection correctly', () => {
      const selection = createRangeSelection([0, 1], 3, [0, 2], 7);

      expect(selection).toEqual({
        startPath: [0, 1],
        startOffset: 3,
        endPath: [0, 2],
        endOffset: 7,
        isCollapsed: false,
      });
    });

    it('should correctly compare selections for equality', () => {
      const selection1 = createCollapsedSelection([0, 1], 5);
      const selection2 = createCollapsedSelection([0, 1], 5);
      const selection3 = createCollapsedSelection([0, 1], 6);

      expect(selectionsEqual(selection1, selection2)).toBe(true);
      expect(selectionsEqual(selection1, selection3)).toBe(false);
    });
  });

  describe('Path-Based Selection Service', () => {
    let selectionService: PathBasedSelectionService;
    let mockVirtualDOM: VNode;

    beforeEach(() => {
      selectionService = new PathBasedSelectionServiceImpl();
      mockVirtualDOM = createInitialParagraphVirtualDOM();
    });

    it('should resolve path to node correctly', () => {
      const node = selectionService.pathToNode(mockVirtualDOM, [0]);
      expect(node).toBeTruthy();
      expect(node?.type).toBe('element');
    });

    it('should return null for invalid path', () => {
      const node = selectionService.pathToNode(mockVirtualDOM, [99, 99]);
      expect(node).toBeNull();
    });

    it('should validate paths correctly', () => {
      expect(selectionService.isValidPath(mockVirtualDOM, [0])).toBe(true);
      expect(selectionService.isValidPath(mockVirtualDOM, [99])).toBe(false);
    });

    it('should find text node at path', () => {
      const textNode = selectionService.getTextNodeAtPath(mockVirtualDOM, [0, 0]);
      expect(textNode?.type).toBe('text');
    });
  });

  describe('UndoRedoService', () => {
    let undoRedoService: UndoRedoService;
    let initialState: EditorState;

    beforeEach(() => {
      initialState = createInitialEditorState(createInitialParagraphVirtualDOM());
      undoRedoService = new CircularBufferUndoRedoService(initialState, 10);
    });

    it('should initialize with no undo/redo available', () => {
      expect(undoRedoService.canUndo()).toBe(false);
      expect(undoRedoService.canRedo()).toBe(false);
    });

    it('should create insert text operation with inverse', () => {
      const operation = createInsertTextOperation({
        path: [0],
        offset: 0,
        text: 'Hello',
      });

      expect(operation.type).toBe('insertText');
      expect(operation.inverse.type).toBe('deleteText');
      expect(operation.inverse.inverse).toBe(operation);
    });

    it('should create delete text operation with inverse', () => {
      const operation = createDeleteTextOperation({
        path: [0],
        startOffset: 0,
        endOffset: 5,
        deletedText: 'Hello',
      });

      expect(operation.type).toBe('deleteText');
      expect(operation.inverse.type).toBe('insertText');
      expect(operation.inverse.inverse).toBe(operation);
    });

    it('should support circular buffer behavior', () => {
      const service = new CircularBufferUndoRedoService(initialState, 2); // Small buffer

      // Fill buffer beyond capacity
      const op1 = createInsertTextOperation({ path: [0], offset: 0, text: '1' });
      const op2 = createInsertTextOperation({ path: [0], offset: 1, text: '2' });
      const op3 = createInsertTextOperation({ path: [0], offset: 2, text: '3' });

      service.execute(op1);
      service.execute(op2);
      service.execute(op3);

      // Should still be able to undo (circular buffer manages capacity)
      expect(service.canUndo()).toBe(true);
    });
  });

  describe('Phase21EditorCore Integration', () => {
    let editorCore: Phase21EditorCore;
    let mockElement: HTMLElement;

    beforeEach(() => {
      const initialVDOM = createInitialParagraphVirtualDOM();
      editorCore = createPhase21EditorCore(initialVDOM, {
        enableDebugMode: true,
        maxUndoOperations: 10,
      });

      // Create mock DOM element
      mockElement = document.createElement('div');
      mockElement.setAttribute('contenteditable', 'true');
      document.body.appendChild(mockElement);
    });

    afterEach(() => {
      editorCore.destroy();
      document.body.removeChild(mockElement);
    });

    it('should initialize with default state', () => {
      const state = editorCore.getCurrentState();

      expect(state.currentEditorMode).toBe('IDLE');
      expect(state.selection.isCollapsed).toBe(true);
      expect(state.virtualDOM).toBeTruthy();
    });

    it('should initialize editor element', () => {
      expect(() => {
        editorCore.initialize(mockElement);
      }).not.toThrow();
    });

    it('should transition modes correctly', () => {
      editorCore.transitionMode('TYPING');
      expect(editorCore.getCurrentState().currentEditorMode).toBe('TYPING');

      editorCore.transitionMode('SELECTING');
      expect(editorCore.getCurrentState().currentEditorMode).toBe('SELECTING');
    });

    it('should handle state change listeners', () => {
      let callCount = 0;
      let lastState: EditorState | undefined = undefined;

      const unsubscribe = editorCore.onStateChange((newState) => {
        callCount++;
        lastState = newState; // Assign the new state from the callback
      });

      editorCore.transitionMode('TYPING');

      expect(callCount).toBe(1);
      expect(lastState).not.toBeUndefined();
      expect(typeof lastState).toBe('object');
      expect((lastState as unknown as EditorState)?.currentEditorMode).toBe('TYPING');

      unsubscribe();
      editorCore.transitionMode('SELECTING');

      // Should not increment after unsubscribe
      expect(callCount).toBe(1);
    });

    it('should provide debug information', () => {
      const debugInfo = editorCore.getDebugInfo();

      expect(debugInfo).toHaveProperty('currentState');
      expect(debugInfo).toHaveProperty('canUndo');
      expect(debugInfo).toHaveProperty('canRedo');
      expect(debugInfo).toHaveProperty('config');
    });

    it('should handle undo/redo operations', () => {
      expect(editorCore.canUndo()).toBe(false);
      expect(editorCore.canRedo()).toBe(false);

      expect(editorCore.undo()).toBe(false);
      expect(editorCore.redo()).toBe(false);
    });

    it('should sync with DOM without throwing', () => {
      expect(() => {
        editorCore.syncWithDOM(mockElement);
      }).not.toThrow();
    });
  });
});

describe('Phase 2.1 Error Handling', () => {
  it('should handle initialization errors gracefully', () => {
    const invalidVDOM = null as unknown as VNode;

    expect(() => {
      createPhase21EditorCore(invalidVDOM);
    }).toThrow();
  });

  it('should handle invalid paths in selection service', () => {
    const service = new PathBasedSelectionServiceImpl();
    const vdom = createInitialParagraphVirtualDOM();

    expect(service.pathToNode(vdom, [-1])).toBeNull();
    expect(service.pathToNode(vdom, [0, 99, 99])).toBeNull();
  });
});

describe('Phase 2.1 Performance', () => {
  it('should handle large undo buffer efficiently', () => {
    const largeBufferSize = 1000;
    const initialState = createInitialEditorState(createInitialParagraphVirtualDOM());
    const service = new CircularBufferUndoRedoService(initialState, largeBufferSize);

    // Performance test: should handle many operations without significant delay
    const start = performance.now();

    for (let i = 0; i < largeBufferSize * 2; i++) {
      const operation = createInsertTextOperation({
        path: [0],
        offset: i,
        text: i.toString(),
      });
      service.execute(operation);
    }

    const end = performance.now();
    const duration = end - start;

    // Should complete operations in reasonable time (less than 100ms)
    expect(duration).toBeLessThan(100);
    expect(service.canUndo()).toBe(true);
  });
});
