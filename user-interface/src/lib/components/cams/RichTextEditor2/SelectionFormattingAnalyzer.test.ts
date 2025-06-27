/**
 * Unit tests for SelectionFormattingAnalyzer service
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionFormattingAnalyzer } from './SelectionFormattingAnalyzer';
import { createTextNode, createFormattingNode, createRootNode } from './virtual-dom/VNodeFactory';
import { FormattingState, FormattingAnalysis } from './formatting-analysis.types';
import { VNode } from './virtual-dom/VNode';

describe('SelectionFormattingAnalyzer', () => {
  let analyzer: SelectionFormattingAnalyzer;

  beforeEach(() => {
    analyzer = new SelectionFormattingAnalyzer();
  });

  describe('analyzeSelection', () => {
    it('should return NOT_APPLIED for all formats when no selection', () => {
      const selectedNodes: VNode[] = [];

      const result = analyzer.analyzeSelection(selectedNodes);

      expect(result.hasSelection).toBe(false);
      expect(result.bold).toBe(FormattingState.NOT_APPLIED);
      expect(result.italic).toBe(FormattingState.NOT_APPLIED);
      expect(result.underline).toBe(FormattingState.NOT_APPLIED);
      expect(result.selectedNodes).toEqual([]);
      expect(result.totalTextNodes).toBe(0);
      expect(result.boldTextNodes).toBe(0);
      expect(result.italicTextNodes).toBe(0);
      expect(result.underlineTextNodes).toBe(0);
    });

    it('should return NOT_APPLIED for unformatted text nodes', () => {
      const textNode = createTextNode('Hello world');
      const selectedNodes = [textNode];

      const result = analyzer.analyzeSelection(selectedNodes);

      expect(result.hasSelection).toBe(true);
      expect(result.bold).toBe(FormattingState.NOT_APPLIED);
      expect(result.italic).toBe(FormattingState.NOT_APPLIED);
      expect(result.underline).toBe(FormattingState.NOT_APPLIED);
      expect(result.selectedNodes).toEqual([textNode]);
      expect(result.totalTextNodes).toBe(1);
      expect(result.boldTextNodes).toBe(0);
      expect(result.italicTextNodes).toBe(0);
      expect(result.underlineTextNodes).toBe(0);
    });

    it('should return FULLY_APPLIED for text nodes with direct formatting', () => {
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      // Mock parent relationship
      textNode.parent = boldNode;
      boldNode.children = [textNode];

      const selectedNodes = [textNode];

      const result = analyzer.analyzeSelection(selectedNodes);

      expect(result.hasSelection).toBe(true);
      expect(result.bold).toBe(FormattingState.FULLY_APPLIED);
      expect(result.italic).toBe(FormattingState.NOT_APPLIED);
      expect(result.underline).toBe(FormattingState.NOT_APPLIED);
      expect(result.selectedNodes).toEqual([textNode]);
      expect(result.totalTextNodes).toBe(1);
      expect(result.boldTextNodes).toBe(1);
      expect(result.italicTextNodes).toBe(0);
      expect(result.underlineTextNodes).toBe(0);
    });

    it('should return PARTIALLY_APPLIED for mixed formatting in selection', () => {
      const boldNode = createFormattingNode('bold');
      const boldTextNode = createTextNode('Bold text');
      const plainTextNode = createTextNode('Plain text');

      // Mock parent relationship for bold text
      boldTextNode.parent = boldNode;
      boldNode.children = [boldTextNode];

      const selectedNodes = [boldTextNode, plainTextNode];

      const result = analyzer.analyzeSelection(selectedNodes);

      expect(result.hasSelection).toBe(true);
      expect(result.bold).toBe(FormattingState.PARTIALLY_APPLIED);
      expect(result.italic).toBe(FormattingState.NOT_APPLIED);
      expect(result.underline).toBe(FormattingState.NOT_APPLIED);
      expect(result.selectedNodes).toEqual([boldTextNode, plainTextNode]);
      expect(result.totalTextNodes).toBe(2);
      expect(result.boldTextNodes).toBe(1);
      expect(result.italicTextNodes).toBe(0);
      expect(result.underlineTextNodes).toBe(0);
    });

    it('should return FULLY_APPLIED for multiple nodes with same formatting', () => {
      const boldNode1 = createFormattingNode('bold');
      const boldNode2 = createFormattingNode('bold');
      const boldTextNode1 = createTextNode('Bold text 1');
      const boldTextNode2 = createTextNode('Bold text 2');

      // Mock parent relationships
      boldTextNode1.parent = boldNode1;
      boldNode1.children = [boldTextNode1];
      boldTextNode2.parent = boldNode2;
      boldNode2.children = [boldTextNode2];

      const selectedNodes = [boldTextNode1, boldTextNode2];

      const result = analyzer.analyzeSelection(selectedNodes);

      expect(result.hasSelection).toBe(true);
      expect(result.bold).toBe(FormattingState.FULLY_APPLIED);
      expect(result.italic).toBe(FormattingState.NOT_APPLIED);
      expect(result.underline).toBe(FormattingState.NOT_APPLIED);
      expect(result.selectedNodes).toEqual([boldTextNode1, boldTextNode2]);
      expect(result.totalTextNodes).toBe(2);
      expect(result.boldTextNodes).toBe(2);
      expect(result.italicTextNodes).toBe(0);
      expect(result.underlineTextNodes).toBe(0);
    });

    it('should handle nested formatting correctly', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const italicNode = createFormattingNode('italic');
      const textNode = createTextNode('Bold italic text');

      // Mock nested parent relationships: root -> bold -> italic -> text
      textNode.parent = italicNode;
      italicNode.parent = boldNode;
      boldNode.parent = root;
      italicNode.children = [textNode];
      boldNode.children = [italicNode];
      root.children = [boldNode];

      const selectedNodes = [textNode];

      const result = analyzer.analyzeSelection(selectedNodes);

      expect(result.hasSelection).toBe(true);
      expect(result.bold).toBe(FormattingState.FULLY_APPLIED);
      expect(result.italic).toBe(FormattingState.FULLY_APPLIED);
      expect(result.underline).toBe(FormattingState.NOT_APPLIED);
      expect(result.selectedNodes).toEqual([textNode]);
      expect(result.totalTextNodes).toBe(1);
      expect(result.boldTextNodes).toBe(1);
      expect(result.italicTextNodes).toBe(1);
      expect(result.underlineTextNodes).toBe(0);
    });

    it('should handle multiple formatting types in mixed selection', () => {
      const boldNode = createFormattingNode('bold');
      const italicNode = createFormattingNode('italic');
      const boldTextNode = createTextNode('Bold text');
      const italicTextNode = createTextNode('Italic text');
      const plainTextNode = createTextNode('Plain text');

      // Mock parent relationships
      boldTextNode.parent = boldNode;
      boldNode.children = [boldTextNode];
      italicTextNode.parent = italicNode;
      italicNode.children = [italicTextNode];

      const selectedNodes = [boldTextNode, italicTextNode, plainTextNode];

      const result = analyzer.analyzeSelection(selectedNodes);

      expect(result.hasSelection).toBe(true);
      expect(result.bold).toBe(FormattingState.PARTIALLY_APPLIED);
      expect(result.italic).toBe(FormattingState.PARTIALLY_APPLIED);
      expect(result.underline).toBe(FormattingState.NOT_APPLIED);
      expect(result.selectedNodes).toEqual([boldTextNode, italicTextNode, plainTextNode]);
      expect(result.totalTextNodes).toBe(3);
      expect(result.boldTextNodes).toBe(1);
      expect(result.italicTextNodes).toBe(1);
      expect(result.underlineTextNodes).toBe(0);
    });
  });

  describe('getFormattingState', () => {
    it('should return NOT_APPLIED when no nodes have formatting', () => {
      const analysis: FormattingAnalysis = {
        bold: FormattingState.NOT_APPLIED,
        italic: FormattingState.NOT_APPLIED,
        underline: FormattingState.NOT_APPLIED,
        selectedNodes: [],
        hasSelection: false,
        totalTextNodes: 2,
        boldTextNodes: 0,
        italicTextNodes: 0,
        underlineTextNodes: 0,
      };

      expect(analyzer.getFormattingState(analysis, 'bold')).toBe(FormattingState.NOT_APPLIED);
      expect(analyzer.getFormattingState(analysis, 'italic')).toBe(FormattingState.NOT_APPLIED);
      expect(analyzer.getFormattingState(analysis, 'underline')).toBe(FormattingState.NOT_APPLIED);
    });

    it('should return FULLY_APPLIED when all nodes have formatting', () => {
      const analysis: FormattingAnalysis = {
        bold: FormattingState.FULLY_APPLIED,
        italic: FormattingState.NOT_APPLIED,
        underline: FormattingState.NOT_APPLIED,
        selectedNodes: [],
        hasSelection: true,
        totalTextNodes: 2,
        boldTextNodes: 2,
        italicTextNodes: 0,
        underlineTextNodes: 0,
      };

      expect(analyzer.getFormattingState(analysis, 'bold')).toBe(FormattingState.FULLY_APPLIED);
      expect(analyzer.getFormattingState(analysis, 'italic')).toBe(FormattingState.NOT_APPLIED);
      expect(analyzer.getFormattingState(analysis, 'underline')).toBe(FormattingState.NOT_APPLIED);
    });

    it('should return PARTIALLY_APPLIED when some nodes have formatting', () => {
      const analysis: FormattingAnalysis = {
        bold: FormattingState.PARTIALLY_APPLIED,
        italic: FormattingState.NOT_APPLIED,
        underline: FormattingState.NOT_APPLIED,
        selectedNodes: [],
        hasSelection: true,
        totalTextNodes: 3,
        boldTextNodes: 1,
        italicTextNodes: 0,
        underlineTextNodes: 0,
      };

      expect(analyzer.getFormattingState(analysis, 'bold')).toBe(FormattingState.PARTIALLY_APPLIED);
      expect(analyzer.getFormattingState(analysis, 'italic')).toBe(FormattingState.NOT_APPLIED);
      expect(analyzer.getFormattingState(analysis, 'underline')).toBe(FormattingState.NOT_APPLIED);
    });
  });
});
