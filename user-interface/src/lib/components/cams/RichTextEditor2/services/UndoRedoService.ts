/**
 * DEPRECATED: This UndoRedoService implementation is deprecated.
 * Use the new operation-based UndoRedoService from core-state/UndoRedoService.ts
 *
 * The new implementation provides:
 * - Operation-based undo/redo with inverse operations
 * - Circular buffer for memory efficiency
 * - Better integration with the Phase 2.1 architecture
 */

import { EditorState } from '../types';

/**
 * Defines the public interface for a service that manages the editor's
 * history of states for undo and redo operations.
 */
export interface UndoRedoService {
  /** Records a new state in the history, clearing any future states (redo stack). */
  record(state: EditorState): void;
  /** Returns the previous state from the history, or null if no past states exist. */
  undo(): EditorState | null;
  /** Returns the next state from the history, or null if no future states exist. */
  redo(): EditorState | null;
  /** Checks if an undo operation can be performed. */
  canUndo(): boolean;
  /** Checks if a redo operation can be performed. */
  canRedo(): boolean;
}

/**
 * Creates an instance of the UndoRedoService.
 * @param initialState - The initial state of the editor to begin the history with.
 * @returns An implementation of the UndoRedoService.
 */
export function createUndoRedoService(initialState: EditorState): UndoRedoService {
  const past: EditorState[] = [];
  let future: EditorState[] = [];
  let present = initialState;

  return {
    record(state: EditorState) {
      past.push(present);
      present = state;
      future = [];
    },
    undo() {
      if (past.length === 0) {
        return null;
      }
      const newPresent = past.pop();
      if (newPresent) {
        future.unshift(present);
        present = newPresent;
        return present;
      }
      return null;
    },
    redo() {
      if (future.length === 0) {
        return null;
      }
      const newPresent = future.shift();
      if (newPresent) {
        past.push(present);
        present = newPresent;
        return present;
      }
      return null;
    },
    canUndo() {
      return past.length > 0;
    },
    canRedo() {
      return future.length > 0;
    },
  };
}
