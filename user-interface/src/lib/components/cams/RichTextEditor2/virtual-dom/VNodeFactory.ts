/**
 * Factory functions for creating virtual DOM nodes
 */

import { VNode, VNodeType, TextNode, ElementNode, FormattingNode, RootNode } from './VNode';

/**
 * Global counter for generating unique node IDs
 */
let nodeIdCounter = 0;

/**
 * Generate a unique ID for a node
 */
export function generateNodeId(): string {
  return `vnode-${++nodeIdCounter}`;
}

/**
 * Options for creating nodes with custom properties
 */
interface BaseNodeOptions {
  parent?: VNode | null;
  startOffset?: number;
  endOffset?: number;
  depth?: number;
}

type TextNodeOptions = BaseNodeOptions;

interface ElementNodeOptions extends BaseNodeOptions {
  attributes?: Record<string, string>;
}

type FormattingNodeOptions = BaseNodeOptions;

interface RootNodeOptions {
  endOffset?: number;
  // Root nodes cannot have parent or custom depth
}

/**
 * Create a text node with the given content
 */
export function createTextNode(content: string, options: TextNodeOptions = {}): TextNode {
  const { parent = null, startOffset = 0, depth = 0 } = options;

  // Calculate endOffset based on content length if not provided
  const endOffset = options.endOffset ?? startOffset + content.length;

  return {
    id: generateNodeId(),
    type: VNodeType.TEXT,
    parent,
    children: [], // Text nodes never have children
    startOffset,
    endOffset,
    depth,
    content,
  };
}

/**
 * Create an element node with the given tag name
 */
export function createElementNode(tagName: string, options: ElementNodeOptions = {}): ElementNode {
  const { parent = null, startOffset = 0, endOffset = 0, depth = 0, attributes = {} } = options;

  return {
    id: generateNodeId(),
    type: VNodeType.ELEMENT,
    parent,
    children: [],
    startOffset,
    endOffset,
    depth,
    tagName,
    attributes,
  };
}

/**
 * Create a formatting node with the given format type
 */
export function createFormattingNode(
  formatType: 'bold' | 'italic' | 'underline',
  options: FormattingNodeOptions = {},
): FormattingNode {
  const { parent = null, startOffset = 0, endOffset = 0, depth = 0 } = options;

  // Map format types to HTML tag names
  const tagNameMap = {
    bold: 'strong' as const,
    italic: 'em' as const,
    underline: 'u' as const,
  };

  return {
    id: generateNodeId(),
    type: VNodeType.FORMATTING,
    parent,
    children: [],
    startOffset,
    endOffset,
    depth,
    formatType,
    tagName: tagNameMap[formatType],
  };
}

/**
 * Create a root node for the document
 */
export function createRootNode(options: RootNodeOptions = {}): RootNode {
  const { endOffset = 0 } = options;

  return {
    id: generateNodeId(),
    type: VNodeType.ROOT,
    parent: null, // Root always has null parent
    children: [],
    startOffset: 0, // Root always starts at 0
    endOffset,
    depth: 0, // Root is always at depth 0
  };
}

/**
 * Reset the node ID counter (useful for testing)
 */
export function resetNodeIdCounter(): void {
  nodeIdCounter = 0;
}
