/**
 * Unit tests for FormattingRemover utility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FormattingRemover } from './FormattingRemover';
import { createTextNode, createFormattingNode, createRootNode } from './virtual-dom/VNodeFactory';

describe('FormattingRemover', () => {
  let remover: FormattingRemover;

  beforeEach(() => {
    remover = new FormattingRemover();
  });

  describe('unwrapFormattingNode', () => {
    it('should unwrap a simple formatting node and promote its children', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      // Setup parent-child relationships: root -> bold -> text
      boldNode.parent = root;
      textNode.parent = boldNode;
      boldNode.children = [textNode];
      root.children = [boldNode];

      const result = remover.unwrapFormattingNode(boldNode);

      expect(result).toEqual([textNode]);
      expect(textNode.parent).toBe(root);
      expect(root.children).toEqual([textNode]);
      expect(boldNode.parent).toBe(null);
      expect(boldNode.children).toEqual([]);
    });

    it('should handle formatting node with multiple children', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode1 = createTextNode('Bold ');
      const textNode2 = createTextNode('text');

      // Setup parent-child relationships: root -> bold -> [text1, text2]
      boldNode.parent = root;
      textNode1.parent = boldNode;
      textNode2.parent = boldNode;
      boldNode.children = [textNode1, textNode2];
      root.children = [boldNode];

      const result = remover.unwrapFormattingNode(boldNode);

      expect(result).toEqual([textNode1, textNode2]);
      expect(textNode1.parent).toBe(root);
      expect(textNode2.parent).toBe(root);
      expect(root.children).toEqual([textNode1, textNode2]);
      expect(boldNode.parent).toBe(null);
      expect(boldNode.children).toEqual([]);
    });

    it('should handle formatting node with no children', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');

      // Setup parent-child relationships: root -> bold (no children)
      boldNode.parent = root;
      root.children = [boldNode];

      const result = remover.unwrapFormattingNode(boldNode);

      expect(result).toEqual([]);
      expect(root.children).toEqual([]);
      expect(boldNode.parent).toBe(null);
    });

    it('should handle formatting node with nested formatting children', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const italicNode = createFormattingNode('italic');
      const textNode = createTextNode('Bold italic text');

      // Setup parent-child relationships: root -> bold -> italic -> text
      boldNode.parent = root;
      italicNode.parent = boldNode;
      textNode.parent = italicNode;
      boldNode.children = [italicNode];
      italicNode.children = [textNode];
      root.children = [boldNode];

      const result = remover.unwrapFormattingNode(boldNode);

      expect(result).toEqual([italicNode]);
      expect(italicNode.parent).toBe(root);
      expect(root.children).toEqual([italicNode]);
      expect(boldNode.parent).toBe(null);
      expect(boldNode.children).toEqual([]);
      // The italic node should still contain the text
      expect(italicNode.children).toEqual([textNode]);
      expect(textNode.parent).toBe(italicNode);
    });
  });

  describe('removeFormatting', () => {
    it('should return original node if it does not have the target formatting', () => {
      const textNode = createTextNode('Plain text');

      const result = remover.removeFormatting(textNode, 'bold');

      expect(result).toEqual([textNode]);
    });

    it('should unwrap formatting node that matches the target format', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      // Setup parent-child relationships: root -> bold -> text
      boldNode.parent = root;
      textNode.parent = boldNode;
      boldNode.children = [textNode];
      root.children = [boldNode];

      const result = remover.removeFormatting(boldNode, 'bold');

      expect(result).toEqual([textNode]);
      expect(textNode.parent).toBe(root);
      expect(root.children).toEqual([textNode]);
    });

    it('should not unwrap formatting node that does not match the target format', () => {
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      // Setup parent-child relationships
      textNode.parent = boldNode;
      boldNode.children = [textNode];

      const result = remover.removeFormatting(boldNode, 'italic');

      expect(result).toEqual([boldNode]);
      expect(textNode.parent).toBe(boldNode);
      expect(boldNode.children).toEqual([textNode]);
    });

    // TODO this is exactly the same as 'should unwrap formatting node that matches the target format'
    // let's make this a more complex test case
    it('should remove formatting from ancestors of text nodes', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      // Setup parent-child relationships: root -> bold -> text
      boldNode.parent = root;
      textNode.parent = boldNode;
      boldNode.children = [textNode];
      root.children = [boldNode];

      // Remove bold formatting from the text node (should unwrap bold ancestor)
      const result = remover.removeFormatting(textNode, 'bold');

      expect(result).toEqual([textNode]);
      expect(textNode.parent).toBe(root);
      expect(root.children).toEqual([textNode]);
    });

    it('should handle nested formatting removal correctly', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const italicNode = createFormattingNode('italic');
      const textNode = createTextNode('Bold italic text');

      // Setup parent-child relationships: root -> bold -> italic -> text
      boldNode.parent = root;
      italicNode.parent = boldNode;
      textNode.parent = italicNode;
      boldNode.children = [italicNode];
      italicNode.children = [textNode];
      root.children = [boldNode];

      // Remove bold formatting from the text node
      const result = remover.removeFormatting(textNode, 'bold');

      expect(result).toEqual([textNode]);
      // Bold should be removed, but italic should remain
      expect(textNode.parent).toBe(italicNode);
      expect(italicNode.parent).toBe(root);
      expect(root.children).toEqual([italicNode]);
      expect(italicNode.children).toEqual([textNode]);
    });
  });

  describe('removeFormattingFromSelection', () => {
    it('should handle empty selection', () => {
      const result = remover.removeFormattingFromSelection([], 'bold');

      expect(result).toEqual([]);
    });

    it('should remove formatting from multiple nodes', () => {
      const root = createRootNode();
      const boldNode1 = createFormattingNode('bold');
      const boldNode2 = createFormattingNode('bold');
      const textNode1 = createTextNode('Bold text 1');
      const textNode2 = createTextNode('Bold text 2');

      // Setup parent-child relationships
      boldNode1.parent = root;
      boldNode2.parent = root;
      textNode1.parent = boldNode1;
      textNode2.parent = boldNode2;
      boldNode1.children = [textNode1];
      boldNode2.children = [textNode2];
      root.children = [boldNode1, boldNode2];

      const selectedNodes = [textNode1, textNode2];
      const result = remover.removeFormattingFromSelection(selectedNodes, 'bold');

      expect(result).toEqual([textNode1, textNode2]);
      expect(textNode1.parent).toBe(root);
      expect(textNode2.parent).toBe(root);
      expect(root.children).toEqual([textNode1, textNode2]);
    });

    it('should handle mixed selection with some formatted and some unformatted nodes', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const boldTextNode = createTextNode('Bold text');
      const plainTextNode = createTextNode('Plain text');

      // Setup parent-child relationships
      boldNode.parent = root;
      boldTextNode.parent = boldNode;
      plainTextNode.parent = root;
      boldNode.children = [boldTextNode];
      root.children = [boldNode, plainTextNode];

      const selectedNodes = [boldTextNode, plainTextNode];
      const result = remover.removeFormattingFromSelection(selectedNodes, 'bold');

      expect(result).toEqual([boldTextNode, plainTextNode]);
      expect(boldTextNode.parent).toBe(root);
      expect(plainTextNode.parent).toBe(root);
      expect(root.children).toEqual([boldTextNode, plainTextNode]);
    });

    it('should preserve other formatting when removing specific format', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const italicNode = createFormattingNode('italic');
      const textNode = createTextNode('Bold italic text');

      // Setup parent-child relationships: root -> bold -> italic -> text
      boldNode.parent = root;
      italicNode.parent = boldNode;
      textNode.parent = italicNode;
      boldNode.children = [italicNode];
      italicNode.children = [textNode];
      root.children = [boldNode];

      const selectedNodes = [textNode];
      const result = remover.removeFormattingFromSelection(selectedNodes, 'bold');

      expect(result).toEqual([textNode]);
      // Bold should be removed, but italic should remain
      expect(textNode.parent).toBe(italicNode);
      expect(italicNode.parent).toBe(root);
      expect(root.children).toEqual([italicNode]);
    });
  });
});
