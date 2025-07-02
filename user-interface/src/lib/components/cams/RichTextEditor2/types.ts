import { VNode, RootNode } from './virtual-dom/VNode';

/**
 * DEPRECATED: Legacy selection state using VNode references.
 * New implementations should use path-based Selection from core-state/EditorState.ts
 *
 * Defines the state of the user's selection within the virtual DOM.
 * The selection is represented by a range between an anchor and a focus point,
 * much like the browser's native Selection API.
 */
export interface LegacySelectionState {
  /** The VNode where the selection begins. */
  anchorNode: VNode;
  /** The character offset within the anchorNode where the selection begins. */
  anchorOffset: number;
  /** The VNode where the selection ends. */
  focusNode: VNode;
  /** The character offset within the focusNode where the selection ends. */
  focusOffset: number;
  /** True if the selection is collapsed (i.e., it's a cursor). */
  isCollapsed: boolean;
}

/**
 * DEPRECATED: Legacy editor state using VNode references.
 * New implementations should use EditorState from core-state/EditorState.ts
 *
 * Represents the complete, immutable state of the editor at a single point in time.
 * This includes the entire document structure (vdom) and the user's selection.
 * This atomic unit is passed to mutation functions and stored in the undo/redo history.
 */
export interface LegacyEditorState {
  /** The root node of the virtual DOM tree. */
  readonly vdom: RootNode;
  /** The state of the user's selection. */
  readonly selection: LegacySelectionState;
}

// Keep backward compatibility aliases
/** @deprecated Use LegacySelectionState instead */
export type SelectionState = LegacySelectionState;
/** @deprecated Use LegacyEditorState instead */
export type EditorState = LegacyEditorState;
