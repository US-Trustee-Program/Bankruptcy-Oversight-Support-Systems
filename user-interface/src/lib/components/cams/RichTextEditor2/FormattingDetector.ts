/**
 * FormattingDetector utility for analyzing formatting in virtual DOM nodes
 */

import { VNode, isFormattingNode } from './virtual-dom/VNode';
import { FormattingType } from './formatting-analysis.types';

/**
 * Utility class for detecting formatting in virtual DOM nodes
 */
export class FormattingDetector {
  /**
   * Check if a node has the specified formatting type
   */
  static hasFormatting(node: VNode, formatType: FormattingType): boolean {
    if (!isFormattingNode(node)) {
      return false;
    }

    return node.formatType === formatType;
  }

  /**
   * Get all formatting types applied to a node
   */
  static getAppliedFormats(node: VNode): FormattingType[] {
    if (!isFormattingNode(node)) {
      return [];
    }

    return [node.formatType];
  }

  /**
   * Check if a node is a descendant of a formatting node of the specified type
   */
  static isDescendantOfFormatting(node: VNode, formatType: FormattingType): boolean {
    let currentNode = node.parent;

    while (currentNode !== null) {
      if (isFormattingNode(currentNode) && currentNode.formatType === formatType) {
        return true;
      }
      currentNode = currentNode.parent;
    }

    return false;
  }

  /**
   * Check if a node has the specified formatting either directly or through inheritance
   */
  static hasFormattingIncludingAncestors(node: VNode, formatType: FormattingType): boolean {
    return this.hasFormatting(node, formatType) || this.isDescendantOfFormatting(node, formatType);
  }

  /**
   * Get all formatting types applied to a node, including inherited from ancestors
   */
  static getAllFormatsIncludingAncestors(node: VNode): FormattingType[] {
    const formats = new Set<FormattingType>();

    // Add direct formats if this is a formatting node
    if (isFormattingNode(node)) {
      formats.add(node.formatType);
    }

    // Add inherited formats from ancestors
    let currentNode = node.parent;
    while (currentNode !== null) {
      if (isFormattingNode(currentNode)) {
        formats.add(currentNode.formatType);
      }
      currentNode = currentNode.parent;
    }

    return Array.from(formats);
  }
}
