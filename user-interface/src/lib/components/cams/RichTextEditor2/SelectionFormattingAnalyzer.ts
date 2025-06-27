/**
 * SelectionFormattingAnalyzer service for analyzing formatting states across selections
 */

import { VNode, isTextNode } from './virtual-dom/VNode';
import { FormattingAnalysis, FormattingState, FormattingType } from './formatting-analysis.types';
import { FormattingDetector } from './FormattingDetector';

/**
 * Service for analyzing formatting states across text selections
 */
export class SelectionFormattingAnalyzer {
  /**
   * Analyze the formatting state of a selection of virtual DOM nodes
   */
  analyzeSelection(selectedNodes: VNode[]): FormattingAnalysis {
    if (selectedNodes.length === 0) {
      return this.createEmptyAnalysis();
    }

    // Filter to only text nodes for formatting analysis
    const textNodes = selectedNodes.filter(isTextNode);
    const totalTextNodes = textNodes.length;

    if (totalTextNodes === 0) {
      return this.createEmptyAnalysis();
    }

    // Count nodes with each type of formatting
    const boldTextNodes = textNodes.filter((node) =>
      FormattingDetector.hasFormattingIncludingAncestors(node, 'bold'),
    ).length;

    const italicTextNodes = textNodes.filter((node) =>
      FormattingDetector.hasFormattingIncludingAncestors(node, 'italic'),
    ).length;

    const underlineTextNodes = textNodes.filter((node) =>
      FormattingDetector.hasFormattingIncludingAncestors(node, 'underline'),
    ).length;

    // Determine formatting states
    const bold = this.determineFormattingState(boldTextNodes, totalTextNodes);
    const italic = this.determineFormattingState(italicTextNodes, totalTextNodes);
    const underline = this.determineFormattingState(underlineTextNodes, totalTextNodes);

    return {
      bold,
      italic,
      underline,
      selectedNodes,
      hasSelection: true,
      totalTextNodes,
      boldTextNodes,
      italicTextNodes,
      underlineTextNodes,
    };
  }

  /**
   * Get the formatting state for a specific format type from an analysis
   */
  getFormattingState(analysis: FormattingAnalysis, formatType: FormattingType): FormattingState {
    switch (formatType) {
      case 'bold':
        return analysis.bold;
      case 'italic':
        return analysis.italic;
      case 'underline':
        return analysis.underline;
      default:
        return FormattingState.NOT_APPLIED;
    }
  }

  /**
   * Get the virtual DOM nodes from a selection that intersect with the given range
   */
  getNodesInRange(virtualDOMRoot: VNode, startOffset: number, endOffset: number): VNode[] {
    const nodesInRange: VNode[] = [];
    this.traverseNodes(virtualDOMRoot, (node) => {
      // Check if node intersects with the range
      if (node.startOffset < endOffset && node.endOffset > startOffset) {
        nodesInRange.push(node);
      }
    });
    return nodesInRange;
  }

  /**
   * Create an empty analysis for when there's no selection
   */
  private createEmptyAnalysis(): FormattingAnalysis {
    return {
      bold: FormattingState.NOT_APPLIED,
      italic: FormattingState.NOT_APPLIED,
      underline: FormattingState.NOT_APPLIED,
      selectedNodes: [],
      hasSelection: false,
      totalTextNodes: 0,
      boldTextNodes: 0,
      italicTextNodes: 0,
      underlineTextNodes: 0,
    };
  }

  /**
   * Determine the formatting state based on count of formatted vs total nodes
   */
  private determineFormattingState(formattedCount: number, totalCount: number): FormattingState {
    if (formattedCount === 0) {
      return FormattingState.NOT_APPLIED;
    } else if (formattedCount === totalCount) {
      return FormattingState.FULLY_APPLIED;
    } else {
      return FormattingState.PARTIALLY_APPLIED;
    }
  }

  /**
   * Traverse all nodes in a tree and call the callback for each
   */
  private traverseNodes(node: VNode, callback: (node: VNode) => void): void {
    callback(node);
    for (const child of node.children) {
      this.traverseNodes(child, callback);
    }
  }
}
