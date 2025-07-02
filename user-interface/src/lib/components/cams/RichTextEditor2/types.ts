import { VNode, RootNode } from './virtual-dom/VNode';

/**
 * Defines the state of the user's selection within the virtual DOM.
 * The selection is represented by a range between an anchor and a focus point,
 * much like the browser's native Selection API.
 */
export interface SelectionState {
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
 * Represents the complete, immutable state of the editor at a single point in time.
 * This includes the entire document structure (vdom) and the user's selection.
 * This atomic unit is passed to mutation functions and stored in the undo/redo history.
 */
export interface EditorState {
  /** The root node of the virtual DOM tree. */
  readonly vdom: RootNode;
  /** The state of the user's selection. */
  readonly selection: SelectionState;
}

/**
 * React event with beforeinput native event
 */
export interface BeforeInputEvent extends React.FormEvent<HTMLDivElement> {
  nativeEvent: InputEvent;
}

/**
 * Position within a DOM node for cursor placement
 */
export interface DOMPosition {
  node: Node;
  offset: number;
}
