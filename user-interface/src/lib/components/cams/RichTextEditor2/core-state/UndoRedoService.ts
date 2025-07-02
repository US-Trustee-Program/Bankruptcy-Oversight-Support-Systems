/**
 * Operation-Based Undo/Redo Architecture
 * Implementation of DECISION-012: Operation-Based Undo/Redo Architecture
 */

import { EditorState } from './EditorState';

/**
 * Operation types for the editor
 * Each operation must have a corresponding inverse operation
 */
export type OperationType =
  | 'insertText'
  | 'deleteText'
  | 'formatText'
  | 'insertParagraph'
  | 'toggleList';

/**
 * Base interface for all editor operations
 * Each operation contains its data and inverse operation for undo/redo
 */
export interface EditorOperation {
  /** Type of operation being performed */
  type: OperationType;
  /** Operation-specific data (strongly typed, no 'any' types) */
  data: unknown;
  /** The operation to undo this one */
  inverse: EditorOperation;
  /** When the operation was executed */
  timestamp: number;
}

/**
 * Insert text operation data
 */
export interface InsertTextData {
  /** Path to the node where text is inserted */
  path: number[];
  /** Position within the node where text is inserted */
  offset: number;
  /** Text content being inserted */
  text: string;
}

/**
 * Delete text operation data
 */
export interface DeleteTextData {
  /** Path to the node where text is deleted */
  path: number[];
  /** Start position of deletion */
  startOffset: number;
  /** End position of deletion */
  endOffset: number;
  /** Text content being deleted (for inverse operation) */
  deletedText: string;
}

/**
 * Format text operation data
 */
export interface FormatTextData {
  /** Path to start of selection being formatted */
  startPath: number[];
  /** Start offset of formatted range */
  startOffset: number;
  /** Path to end of selection being formatted */
  endPath: number[];
  /** End offset of formatted range */
  endOffset: number;
  /** Type of formatting being applied/removed */
  formatType: 'bold' | 'italic' | 'underline';
  /** Whether formatting is being applied (true) or removed (false) */
  isApplying: boolean;
}

/**
 * Insert paragraph operation data
 */
export interface InsertParagraphData {
  /** Path where new paragraph is inserted */
  path: number[];
  /** Content of the new paragraph */
  content: string;
}

/**
 * Toggle list operation data
 */
export interface ToggleListData {
  /** Path to the paragraph being converted to/from list */
  path: number[];
  /** Type of list ('ul' | 'ol') or null if converting from list to paragraph */
  listType: 'ul' | 'ol' | null;
  /** Previous state for inverse operation */
  previousState: 'paragraph' | 'ul' | 'ol';
}

/**
 * Type-safe operation creators
 */
export function createInsertTextOperation(data: InsertTextData): EditorOperation {
  // Create a placeholder for the inverse operation
  const operation: EditorOperation = {
    type: 'insertText',
    data,
    inverse: {} as EditorOperation, // Temporary placeholder
    timestamp: Date.now(),
  };

  const inverse: EditorOperation = {
    type: 'deleteText',
    data: {
      path: data.path,
      startOffset: data.offset,
      endOffset: data.offset + data.text.length,
      deletedText: data.text,
    } as DeleteTextData,
    inverse: operation, // Set circular reference
    timestamp: Date.now(),
  };

  // Complete the circular reference
  operation.inverse = inverse;
  return operation;
}

export function createDeleteTextOperation(data: DeleteTextData): EditorOperation {
  // Create a placeholder for the inverse operation
  const operation: EditorOperation = {
    type: 'deleteText',
    data,
    inverse: {} as EditorOperation, // Temporary placeholder
    timestamp: Date.now(),
  };

  const inverse: EditorOperation = {
    type: 'insertText',
    data: {
      path: data.path,
      offset: data.startOffset,
      text: data.deletedText,
    } as InsertTextData,
    inverse: operation, // Set circular reference
    timestamp: Date.now(),
  };

  // Complete the circular reference
  operation.inverse = inverse;
  return operation;
}

/**
 * UndoRedoService interface for operation-based history management
 * Implementation uses circular buffer for memory efficiency
 */
export interface UndoRedoService {
  /** Execute operation and update history */
  execute(operation: EditorOperation): EditorState;
  /** Undo last operation */
  undo(): EditorState | null;
  /** Redo previously undone operation */
  redo(): EditorState | null;
  /** Whether undo is available */
  canUndo(): boolean;
  /** Whether redo is available */
  canRedo(): boolean;
  /** Clear all history */
  clear(): void;
  /** Get current state */
  getCurrentState(): EditorState;
}

/**
 * Circular buffer implementation for memory-efficient operation history
 * Automatically manages memory by overwriting oldest operations when buffer is full
 */
export class CircularBufferUndoRedoService implements UndoRedoService {
  private readonly buffer: EditorOperation[];
  private readonly maxSize: number;
  private head: number = 0; // Points to the next position to write
  private size: number = 0; // Current number of operations in buffer
  private currentPosition: number = -1; // Current position in undo/redo chain
  private currentState: EditorState;

  constructor(initialState: EditorState, maxSize: number = 100) {
    this.buffer = new Array(maxSize);
    this.maxSize = maxSize;
    this.currentState = initialState;
  }

  execute(operation: EditorOperation): EditorState {
    // Apply the operation to get new state
    this.currentState = this.applyOperation(this.currentState, operation);

    // Add operation to buffer
    this.buffer[this.head] = operation;
    this.currentPosition = this.head;
    this.head = (this.head + 1) % this.maxSize;

    if (this.size < this.maxSize) {
      this.size++;
    }

    return this.currentState;
  }

  undo(): EditorState | null {
    if (!this.canUndo()) {
      return null;
    }

    const operation = this.buffer[this.currentPosition];
    this.currentState = this.applyOperation(this.currentState, operation.inverse);

    // Move position back in circular buffer
    this.currentPosition =
      this.currentPosition === 0
        ? this.size === this.maxSize
          ? this.maxSize - 1
          : -1
        : this.currentPosition - 1;

    return this.currentState;
  }

  redo(): EditorState | null {
    if (!this.canRedo()) {
      return null;
    }

    // Move position forward
    this.currentPosition = (this.currentPosition + 1) % this.maxSize;
    const operation = this.buffer[this.currentPosition];
    this.currentState = this.applyOperation(this.currentState, operation);

    return this.currentState;
  }

  canUndo(): boolean {
    return this.currentPosition !== -1 && this.size > 0;
  }

  canRedo(): boolean {
    if (this.size === 0) {
      return false;
    }

    const nextPosition = (this.currentPosition + 1) % this.maxSize;
    return nextPosition !== this.head && (this.size < this.maxSize || nextPosition < this.size);
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
    this.currentPosition = -1;
    // Clear the buffer by creating a new array
    for (let i = 0; i < this.buffer.length; i++) {
      delete this.buffer[i];
    }
  }

  getCurrentState(): EditorState {
    return this.currentState;
  }

  /**
   * Apply an operation to a state to produce a new state
   * This is where the actual state mutation logic will be implemented
   */
  private applyOperation(state: EditorState, operation: EditorOperation): EditorState {
    // TODO: Implement actual operation application logic
    // This is a placeholder that will be filled in with actual mutation logic
    switch (operation.type) {
      case 'insertText':
        return this.applyInsertText(state, operation.data as InsertTextData);
      case 'deleteText':
        return this.applyDeleteText(state, operation.data as DeleteTextData);
      case 'formatText':
        return this.applyFormatText(state, operation.data as FormatTextData);
      case 'insertParagraph':
        return this.applyInsertParagraph(state, operation.data as InsertParagraphData);
      case 'toggleList':
        return this.applyToggleList(state, operation.data as ToggleListData);
      default: {
        // Use a type assertion that's safer
        const unknownOp = operation as { type: string };
        throw new Error(`Unknown operation type: ${unknownOp.type}`);
      }
    }
  }

  // Placeholder mutation methods - will be implemented with actual virtual DOM operations
  private applyInsertText(state: EditorState, _data: InsertTextData): EditorState {
    // TODO: Implement with virtual DOM text insertion
    return state;
  }

  private applyDeleteText(state: EditorState, _data: DeleteTextData): EditorState {
    // TODO: Implement with virtual DOM text deletion
    return state;
  }

  private applyFormatText(state: EditorState, _data: FormatTextData): EditorState {
    // TODO: Implement with virtual DOM formatting
    return state;
  }

  private applyInsertParagraph(state: EditorState, _data: InsertParagraphData): EditorState {
    // TODO: Implement with virtual DOM paragraph insertion
    return state;
  }

  private applyToggleList(state: EditorState, _data: ToggleListData): EditorState {
    // TODO: Implement with virtual DOM list operations
    return state;
  }
}
