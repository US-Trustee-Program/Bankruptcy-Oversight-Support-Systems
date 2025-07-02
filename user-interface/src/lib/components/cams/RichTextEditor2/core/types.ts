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
  nodeId: string;
  offset: number;
}

export interface VDOMSelection {
  start: VDOMPosition;
  end: VDOMPosition;
  isCollapsed: boolean;
}

// Editor Command Types
export type EditorCommandType =
  | 'INSERT_TEXT'
  | 'DELETE_CONTENT'
  | 'APPLY_FORMAT'
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
  | 'DELETE_KEY';

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
}

// Formatting State Types
export interface RichTextFormatState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
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
  strong: 'strong',
  em: 'em',
  u: 'u',
};
