/**
 * Phase 2.1 Core State Management
 * Export all foundational components for RichTextEditor2
 */
// Core state management
export {
  createInitialEditorState,
  transitionEditorMode,
  updateSelection,
  updateVirtualDOM,
} from './EditorState';

export type { EditorState, Selection, EditorMode, StateTransition } from './EditorState';

// Operation-based undo/redo
export {
  CircularBufferUndoRedoService,
  createInsertTextOperation,
  createDeleteTextOperation,
} from './UndoRedoService';
export type {
  EditorOperation,
  OperationType,
  InsertTextData,
  DeleteTextData,
  FormatTextData,
  InsertParagraphData,
  ToggleListData,
  UndoRedoService,
} from './UndoRedoService';

// Path-based selection management
export {
  PathBasedSelectionServiceImpl,
  createCollapsedSelection,
  createRangeSelection,
  selectionsEqual,
  cloneSelection,
} from './PathBasedSelectionService';
export type { PathBasedSelectionService } from './PathBasedSelectionService';

// BeforeInput event handling
export {
  BeforeInputHandlerImpl,
  BeforeInputEventManager,
  getInputEventData,
  isCompositionInput,
  isDeletionInput,
  isInsertionInput,
} from './BeforeInputHandler';
export type { BeforeInputHandler } from './BeforeInputHandler';

// Error recovery strategy
export { ErrorRecoveryStrategyImpl, RecoveryManager } from './ErrorRecoveryStrategy';
export type { ErrorRecoveryStrategy, RecoveryContext } from './ErrorRecoveryStrategy';

// DOM synchronization
export { DOMSynchronizationServiceImpl, DOMUpdateBatcher } from './DOMSynchronizationService';
export type { DOMSynchronizationService } from './DOMSynchronizationService';

// Main Phase 2.1 coordinator
export {
  Phase21EditorCore,
  createPhase21EditorCore,
  createInitialParagraphVirtualDOM,
} from './Phase21EditorCore';
export type { Phase21CoreConfig } from './Phase21EditorCore';
