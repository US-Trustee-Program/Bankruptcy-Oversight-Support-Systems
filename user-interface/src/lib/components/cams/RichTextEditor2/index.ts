/**
 * RichTextEditor2 Types - Primary API
 *
 * This file provides the main type exports for RichTextEditor2.
 * It prioritizes the new Phase 2.1 architecture with path-based selection
 * and provides backward compatibility aliases for legacy code.
 */

// PRIMARY EXPORTS - Phase 2.1 Architecture (Path-based selection)
export type { EditorState, Selection, EditorMode, StateTransition } from './core-state/EditorState';

export type {
  UndoRedoService,
  EditorOperation,
  OperationType,
  InsertTextData,
  DeleteTextData,
  FormatTextData,
  InsertParagraphData,
  ToggleListData,
} from './core-state/UndoRedoService';

export type { PathBasedSelectionService } from './core-state/PathBasedSelectionService';

export type { BeforeInputHandler } from './core-state/BeforeInputHandler';

export type { ErrorRecoveryStrategy, RecoveryContext } from './core-state/ErrorRecoveryStrategy';

export type { DOMSynchronizationService } from './core-state/DOMSynchronizationService';

export type { Phase21CoreConfig } from './core-state/Phase21EditorCore';

// LEGACY EXPORTS - For backward compatibility (VNode-based selection)
export type {
  // Backward compatibility aliases
  SelectionState,
  EditorState as DeprecatedEditorState,
} from './types';

// VIRTUAL DOM EXPORTS
export type { VNode, RootNode, ElementNode, TextNode, FormattingNode } from './virtual-dom/VNode';

// IMPLEMENTATION EXPORTS
export {
  createPhase21EditorCore,
  createInitialParagraphVirtualDOM,
} from './core-state/Phase21EditorCore';

export {
  createInitialEditorState,
  transitionEditorMode,
  updateSelection,
  updateVirtualDOM,
} from './core-state/EditorState';

export {
  CircularBufferUndoRedoService,
  createInsertTextOperation,
  createDeleteTextOperation,
} from './core-state/UndoRedoService';

export {
  PathBasedSelectionServiceImpl,
  createCollapsedSelection,
  createRangeSelection,
  selectionsEqual,
} from './core-state/PathBasedSelectionService';
