import { RichTextFormat } from '../RichTextEditor.constants';

// VDOM Node Types
export type VDOMNodeType =
  | 'text'
  | 'paragraph'
  | 'strong'
  | 'em'
  | 'u'
  | 'ul'
  | 'ol'
  | 'li'
  | 'br'
  | 'span'
  | 'a';

export interface VDOMNode {
  id: string;
  type: VDOMNodeType;
  content?: string; // For text nodes
  children?: VDOMNode[];
  attributes?: Record<string, string>; // For elements with attributes (e.g., href for links)
}

// VDOM Selection Types
export interface VDOMPosition {
  offset: number; // Offset in the text content
  nodeId?: string; // Optional node ID for node-based selections (used by VDOMMutations)
}

export interface VDOMSelection {
  start: VDOMPosition;
  end: VDOMPosition;
  isCollapsed: boolean;
}

// Format state types
export type FormatStateValue = 'active' | 'inactive' | 'mixed';

export interface RichTextFormatState {
  bold: FormatStateValue;
  italic: FormatStateValue;
  underline: FormatStateValue;
}

// Format toggle state types for tracking user's explicit formatting toggles
export interface FormatToggleState {
  bold: FormatStateValue;
  italic: FormatStateValue;
  underline: FormatStateValue;
}

// Editor Command Types
export type EditorCommandType =
  | 'INSERT_TEXT'
  | 'DELETE_CONTENT'
  | 'APPLY_FORMAT'
  | 'TOGGLE_BOLD'
  | 'TOGGLE_LIST'
  | 'SPLIT_NODE'
  | 'MERGE_NODES'
  | 'NORMALIZE'
  | 'UNDO'
  | 'REDO'
  | 'PASTE'
  | 'CUT'
  | 'COPY'
  | 'ENTER_KEY'
  | 'BACKSPACE'
  | 'DELETE_KEY'
  | 'MOVE_CURSOR_LEFT'
  | 'MOVE_CURSOR_RIGHT'
  | 'MOVE_CURSOR_UP'
  | 'MOVE_CURSOR_DOWN'
  | 'SET_CURSOR_POSITION';

export interface EditorCommand {
  type: EditorCommandType;
  payload?: unknown;
}

// Editor State Types
export interface EditorState {
  vdom: VDOMNode[];
  selection: VDOMSelection;
  canUndo: boolean;
  canRedo: boolean;
  formatToggleState: FormatToggleState;
}

// History Types
export interface HistoryEntry {
  vdom: VDOMNode[];
  selection: VDOMSelection;
  timestamp: number;
}

// FSM Result Types
export interface FSMResult {
  newVDOM: VDOMNode[];
  newSelection: VDOMSelection;
  didChange: boolean;
  isPersistent: boolean;
  formatToggleState?: FormatToggleState; // Optional - only present when toggle state changes
}

// Clipboard Types
export interface ClipboardResult {
  newVDOM: VDOMNode[];
  newSelection: VDOMSelection;
}

// List Types
export type ListType = 'ul' | 'ol';

// Editor Callback Types
export type OnContentChangeCallback = (html: string) => void;
export type OnFormattingChangeCallback = (formatting: RichTextFormatState) => void;
export type OnSelectionUpdateCallback = (selection: VDOMSelection) => void;

// Utility Types
export interface NodeRange {
  startNode: VDOMNode;
  startOffset: number;
  endNode: VDOMNode;
  endOffset: number;
}

export interface TextInsertionPoint {
  node: VDOMNode;
  offset: number;
}

// Constants for VDOM operations
export const VDOM_NODE_TYPES = {
  TEXT: 'text' as const,
  PARAGRAPH: 'paragraph' as const,
  STRONG: 'strong' as const,
  EM: 'em' as const,
  U: 'u' as const,
  UL: 'ul' as const,
  OL: 'ol' as const,
  LI: 'li' as const,
  BR: 'br' as const,
  SPAN: 'span' as const,
  A: 'a' as const,
} as const;

// Format mapping
export const FORMAT_TO_VDOM_TYPE: Record<RichTextFormat, VDOMNodeType> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
};
