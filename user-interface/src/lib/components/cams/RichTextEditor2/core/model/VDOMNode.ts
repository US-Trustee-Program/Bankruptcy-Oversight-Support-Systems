import { VDOMNode, VDOMNodeType, ListType } from '../types';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';

/**
 * Creates a text node with the specified content
 */
export function createTextNode(content: string = ''): VDOMNode {
  return {
    type: 'text',
    content,
    path: [],
  };
}

/**
 * Creates a generic element node with the specified type, children, and attributes
 */
export function createElementNode(
  type: VDOMNodeType,
  children: VDOMNode[] = [],
  attributes?: Record<string, string>,
): VDOMNode {
  const node: VDOMNode = {
    type,
    children,
    path: [],
  };

  if (attributes) {
    node.attributes = attributes;
  }

  return node;
}

/**
 * Creates a paragraph node with the specified children
 */
export function createParagraphNode(children: VDOMNode[] = []): VDOMNode {
  return createElementNode('paragraph', children);
}

/**
 * Creates an empty paragraph node with a zero-width space for proper cursor positioning
 */
export function createEmptyParagraphNode(): VDOMNode {
  return createParagraphNode([createTextNode(ZERO_WIDTH_SPACE)]);
}

/**
 * Creates a strong (bold) element node
 */
export function createStrongNode(children: VDOMNode[] = []): VDOMNode {
  return createElementNode('strong', children);
}

/**
 * Creates an em (italic) element node
 */
export function createEmNode(children: VDOMNode[] = []): VDOMNode {
  return createElementNode('em', children);
}

/**
 * Creates a u (underline) element node
 */
export function createUNode(children: VDOMNode[] = []): VDOMNode {
  return createElementNode('u', children);
}

/**
 * Creates a list node (ul or ol)
 */
export function createListNode(children: VDOMNode[] = [], listType: ListType = 'ul'): VDOMNode {
  return createElementNode(listType, children);
}

/**
 * Creates a list item node
 */
export function createListItemNode(children: VDOMNode[] = []): VDOMNode {
  return createElementNode('li', children);
}
