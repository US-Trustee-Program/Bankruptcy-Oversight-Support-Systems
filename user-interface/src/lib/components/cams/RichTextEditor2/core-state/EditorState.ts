/**
 * Core State Management Types for RichTextEditor2
 * Implementation of DECISION-010: Core State Management Structure
 */

import { VNode } from '../virtual-dom/VNode';

/**
 * Selection state using path-based addressing (DECISION-011)
 * Paths are arrays of indices to navigate the virtual DOM tree
 */
export interface Selection {
  /** Path to start node: [0, 2, 1] = first block, third child, second child */
  startPath: number[];
  /** Character offset within the start node */
  startOffset: number;
  /** Path to end node */
  endPath: number[];
  /** Character offset within the end node */
  endOffset: number;
  /** Whether selection is just a cursor (collapsed) */
  isCollapsed: boolean;
}

/**
 * Finite state machine modes for the editor
 */
export type EditorMode = 'IDLE' | 'TYPING' | 'SELECTING' | 'FORMATTING';

/**
 * Core editor state following atomic state management pattern
 * All state mutations must follow the pattern: (EditorState) => EditorState
 */
export interface EditorState {
  /** Document structure representation using self-documenting name */
  virtualDOM: VNode;
  /** Cursor/selection state using path-based addressing */
  selection: Selection;
  /** Current finite state machine mode */
  currentEditorMode: EditorMode;
}

/**
 * Type signature for all state transition functions
 * All editor operations must follow this pure function pattern
 */
export type StateTransition = (currentState: EditorState) => EditorState;

/**
 * Helper function to create initial editor state
 */
export function createInitialEditorState(initialVirtualDOM: VNode): EditorState {
  return {
    virtualDOM: initialVirtualDOM,
    selection: {
      startPath: [0],
      startOffset: 0,
      endPath: [0],
      endOffset: 0,
      isCollapsed: true,
    },
    currentEditorMode: 'IDLE',
  };
}

/**
 * Helper function to transition editor mode
 */
export function transitionEditorMode(currentState: EditorState, newMode: EditorMode): EditorState {
  return {
    ...currentState,
    currentEditorMode: newMode,
  };
}

/**
 * Helper function to update selection while preserving other state
 */
export function updateSelection(currentState: EditorState, newSelection: Selection): EditorState {
  return {
    ...currentState,
    selection: newSelection,
  };
}

/**
 * Helper function to update virtual DOM while preserving other state
 */
export function updateVirtualDOM(currentState: EditorState, newVirtualDOM: VNode): EditorState {
  return {
    ...currentState,
    virtualDOM: newVirtualDOM,
  };
}
