import DOMPurify from 'dompurify';
import { DOMPURIFY_CONFIG } from '../RichTextEditor.constants';
import {
  VNodeType,
  type VNode,
  type RootNode,
  type TextNode,
  type ElementNode,
  type FormattingNode,
  isTextNode,
  isElementNode,
  isFormattingNode,
  isRootNode,
} from './VNode';

/**
 * HTML Codec for converting between VNode trees and HTML strings
 * Provides safe encoding/decoding with HTML sanitization
 */
export class HtmlCodec {
  /**
   * Encode a VNode tree to HTML string
   */
  static encode(node: VNode): string {
    if (isTextNode(node)) {
      return this.encodeTextNode(node);
    }

    if (isElementNode(node)) {
      return this.encodeElementNode(node);
    }

    if (isFormattingNode(node)) {
      return this.encodeFormattingNode(node);
    }

    if (isRootNode(node)) {
      return this.encodeRootNode(node);
    }

    throw new Error(`Unknown node type: ${node.type}`);
  }

  /**
   * Decode HTML string to VNode tree with sanitization
   */
  static decode(html: string): RootNode {
    // Sanitize the HTML first
    const sanitizedHtml = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);

    // Create a temporary DOM element to parse the HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = sanitizedHtml;

    // Create root node
    const rootNode: RootNode = {
      id: this.generateId('root'),
      type: VNodeType.ROOT,
      parent: null,
      children: [],
      startOffset: 0,
      endOffset: 0,
      depth: 0,
    };

    // Convert DOM nodes to VNodes
    let currentOffset = 0;
    for (const childNode of Array.from(tempDiv.childNodes)) {
      const vNode = this.domNodeToVNode(childNode, rootNode, currentOffset, 1);
      if (vNode) {
        rootNode.children.push(vNode);
        currentOffset = vNode.endOffset;
      }
    }

    rootNode.endOffset = currentOffset;
    return rootNode;
  }

  /**
   * Encode VNode to HTML and sanitize the result
   */
  static encodeToSafeHtml(node: VNode): string {
    const html = this.encode(node);
    return DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
  }

  /**
   * Private helper methods
   */
  private static encodeTextNode(node: TextNode): string {
    return this.escapeHtml(node.content);
  }

  private static encodeElementNode(node: ElementNode): string {
    const allAttributes = { ...node.attributes, 'data-id': node.id };
    const attributes = this.encodeAttributes(allAttributes);
    const childrenHtml = node.children.map((child) => this.encode(child)).join('');

    if (attributes) {
      return `<${node.tagName} ${attributes}>${childrenHtml}</${node.tagName}>`;
    }
    return `<${node.tagName}>${childrenHtml}</${node.tagName}>`;
  }

  private static encodeFormattingNode(node: FormattingNode): string {
    const childrenHtml = node.children.map((child) => this.encode(child)).join('');
    return `<${node.tagName} data-id="${node.id}">${childrenHtml}</${node.tagName}>`;
  }

  private static encodeRootNode(node: RootNode): string {
    return node.children.map((child) => this.encode(child)).join('');
  }

  private static encodeAttributes(attributes: Record<string, string>): string {
    return Object.entries(attributes)
      .map(([key, value]) => `${key}="${this.escapeHtml(value)}"`)
      .join(' ');
  }

  private static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private static domNodeToVNode(
    domNode: Node,
    parent: VNode,
    startOffset: number,
    depth: number,
  ): VNode | null {
    if (domNode.nodeType === Node.TEXT_NODE) {
      const textContent = domNode.textContent || '';
      if (textContent.trim() === '') {
        return null; // Skip empty text nodes
      }

      const textNode: TextNode = {
        id: this.generateId('text'),
        type: VNodeType.TEXT,
        parent,
        children: [],
        startOffset,
        endOffset: startOffset + textContent.length,
        depth,
        content: textContent,
      };

      return textNode;
    }

    if (domNode.nodeType === Node.ELEMENT_NODE) {
      const element = domNode as Element;
      const tagName = element.tagName.toLowerCase();

      // Handle formatting nodes
      if (this.isFormattingTag(tagName)) {
        const formatType = this.getFormatType(tagName);
        if (formatType) {
          const formattingNode: FormattingNode = {
            id: this.generateId('formatting'),
            type: VNodeType.FORMATTING,
            parent,
            children: [],
            startOffset,
            endOffset: startOffset,
            depth,
            formatType,
            tagName: tagName as 'strong' | 'em' | 'u',
          };

          let currentOffset = startOffset;
          for (const childNode of Array.from(element.childNodes)) {
            const childVNode = this.domNodeToVNode(
              childNode,
              formattingNode,
              currentOffset,
              depth + 1,
            );
            if (childVNode) {
              formattingNode.children.push(childVNode);
              currentOffset = childVNode.endOffset;
            }
          }

          formattingNode.endOffset = currentOffset;
          return formattingNode;
        }
      }

      // Handle regular element nodes
      const elementNode: ElementNode = {
        id: this.generateId('element'),
        type: VNodeType.ELEMENT,
        parent,
        children: [],
        startOffset,
        endOffset: startOffset,
        depth,
        tagName,
        attributes: this.extractAttributes(element),
      };

      let currentOffset = startOffset;
      for (const childNode of Array.from(element.childNodes)) {
        const childVNode = this.domNodeToVNode(childNode, elementNode, currentOffset, depth + 1);
        if (childVNode) {
          elementNode.children.push(childVNode);
          currentOffset = childVNode.endOffset;
        }
      }

      elementNode.endOffset = currentOffset;
      return elementNode;
    }

    return null;
  }

  private static isFormattingTag(tagName: string): boolean {
    return ['strong', 'b', 'em', 'i', 'u'].includes(tagName);
  }

  private static getFormatType(tagName: string): 'bold' | 'italic' | 'underline' | null {
    switch (tagName) {
      case 'strong':
      case 'b':
        return 'bold';
      case 'em':
      case 'i':
        return 'italic';
      case 'u':
        return 'underline';
      default:
        return null;
    }
  }

  private static extractAttributes(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  private static generateId(prefix: string): string {
    return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
