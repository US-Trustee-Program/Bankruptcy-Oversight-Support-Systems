/**
 * Virtual DOM Node Types and Interfaces for RichTextEditor2
 */

export enum VNodeType {
  TEXT = 'text',
  ELEMENT = 'element',
  FORMATTING = 'formatting',
  ROOT = 'root',
}

/**
 * Base interface for all virtual DOM nodes
 */
export interface VNode {
  /** Unique identifier for the node */
  id: string;
  /** Type of the node */
  type: VNodeType;
  /** Parent node reference (null for root) */
  parent: VNode | null;
  /** Array of child nodes */
  children: VNode[];
  /** Start offset position in the document */
  startOffset: number;
  /** End offset position in the document */
  endOffset: number;
  /** Depth level in the tree (0 for root) */
  depth: number;
}

/**
 * Text node interface for plain text content
 */
export interface TextNode extends VNode {
  type: VNodeType.TEXT;
  /** Text content of the node */
  content: string;
  /** Text nodes should not have children */
  children: [];
}

/**
 * Element node interface for HTML elements
 */
export interface ElementNode extends VNode {
  type: VNodeType.ELEMENT;
  /** HTML tag name */
  tagName: string;
  /** HTML attributes as key-value pairs */
  attributes: Record<string, string>;
}

/**
 * Formatting node interface for inline formatting
 */
export interface FormattingNode extends VNode {
  type: VNodeType.FORMATTING;
  /** Type of formatting applied */
  formatType: 'bold' | 'italic' | 'underline';
  /** HTML tag name for the formatting */
  tagName: 'strong' | 'em' | 'u';
}

/**
 * Root node interface for the document root
 */
export interface RootNode extends VNode {
  type: VNodeType.ROOT;
  /** Root node should never have a parent */
  parent: null;
  /** Root is always at depth 0 */
  depth: 0;
}

/**
 * Type guard to check if a node is a TextNode
 */
export function isTextNode(node: VNode): node is TextNode {
  return node.type === VNodeType.TEXT;
}

/**
 * Type guard to check if a node is an ElementNode
 */
export function isElementNode(node: VNode): node is ElementNode {
  return node.type === VNodeType.ELEMENT;
}

/**
 * Type guard to check if a node is a FormattingNode
 */
export function isFormattingNode(node: VNode): node is FormattingNode {
  return node.type === VNodeType.FORMATTING;
}

/**
 * Type guard to check if a node is a RootNode
 */
export function isRootNode(node: VNode): node is RootNode {
  return node.type === VNodeType.ROOT;
}

/**
 * Union type for all specific node types
 */
export type AnyVNode = TextNode | ElementNode | FormattingNode | RootNode;
