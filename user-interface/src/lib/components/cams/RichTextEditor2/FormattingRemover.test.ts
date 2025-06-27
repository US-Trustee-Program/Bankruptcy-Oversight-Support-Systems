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

  describe('splitFormattingNodeAtBoundaries', () => {
    it('should return the original node if it has no parent', () => {
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      boldNode.children = [textNode];
      textNode.parent = boldNode;

      const result = remover.splitFormattingNodeAtBoundaries(boldNode, [textNode]);

      expect(result).toEqual([boldNode]);
    });

    it('should unwrap the node if all children are selected', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode1 = createTextNode('Bold');
      const textNode2 = createTextNode(' text');

      // Setup parent-child relationships
      boldNode.parent = root;
      textNode1.parent = boldNode;
      textNode2.parent = boldNode;
      boldNode.children = [textNode1, textNode2];
      root.children = [boldNode];

      const result = remover.splitFormattingNodeAtBoundaries(boldNode, [textNode1, textNode2]);

      expect(result).toEqual([textNode1, textNode2]);
      expect(textNode1.parent).toBe(root);
      expect(textNode2.parent).toBe(root);
      expect(root.children).toEqual([textNode1, textNode2]);
    });

    it('should return the original node if no children are selected', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      // Setup parent-child relationships
      boldNode.parent = root;
      textNode.parent = boldNode;
      boldNode.children = [textNode];
      root.children = [boldNode];

      const result = remover.splitFormattingNodeAtBoundaries(boldNode, []);

      expect(result).toEqual([boldNode]);
      expect(textNode.parent).toBe(boldNode);
      expect(boldNode.parent).toBe(root);
      expect(root.children).toEqual([boldNode]);
    });

    it('should split the node when selection is at the beginning', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode1 = createTextNode('Bold');
      const textNode2 = createTextNode(' text');

      // Setup parent-child relationships
      boldNode.parent = root;
      textNode1.parent = boldNode;
      textNode2.parent = boldNode;
      boldNode.children = [textNode1, textNode2];
      root.children = [boldNode];

      const result = remover.splitFormattingNodeAtBoundaries(boldNode, [textNode1]);

      // Should have textNode1 directly under root and a new bold node with textNode2
      expect(result.length).toBe(2);
      expect(textNode1.parent).toBe(root);

      // Find the new formatting node in the result
      const newBoldNode = result.find(node => isFormattingNode(node));
      expect(newBoldNode).toBeDefined();
      if (newBoldNode && isFormattingNode(newBoldNode)) {
        expect(newBoldNode.formatType).toBe('bold');
        expect(newBoldNode.children).toEqual([textNode2]);
        expect(textNode2.parent).toBe(newBoldNode);
      }

      // Check the root's children
      expect(root.children.length).toBe(2);
      expect(root.children).toContain(textNode1);
      expect(root.children).toContain(newBoldNode);
    });

    it('should split the node when selection is at the end', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode1 = createTextNode('Bold');
      const textNode2 = createTextNode(' text');

      // Setup parent-child relationships
      boldNode.parent = root;
      textNode1.parent = boldNode;
      textNode2.parent = boldNode;
      boldNode.children = [textNode1, textNode2];
      root.children = [boldNode];

      const result = remover.splitFormattingNodeAtBoundaries(boldNode, [textNode2]);

      // Should have a new bold node with textNode1 and textNode2 directly under root
      expect(result.length).toBe(2);
      expect(textNode2.parent).toBe(root);

      // Find the new formatting node in the result
      const newBoldNode = result.find(node => isFormattingNode(node));
      expect(newBoldNode).toBeDefined();
      if (newBoldNode && isFormattingNode(newBoldNode)) {
        expect(newBoldNode.formatType).toBe('bold');
        expect(newBoldNode.children).toEqual([textNode1]);
        expect(textNode1.parent).toBe(newBoldNode);
      }

      // Check the root's children
      expect(root.children.length).toBe(2);
      expect(root.children).toContain(textNode2);
      expect(root.children).toContain(newBoldNode);
    });

    it('should split the node when selection is in the middle', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode1 = createTextNode('Bold');
      const textNode2 = createTextNode(' middle');
      const textNode3 = createTextNode(' text');

      // Setup parent-child relationships
      boldNode.parent = root;
      textNode1.parent = boldNode;
      textNode2.parent = boldNode;
      textNode3.parent = boldNode;
      boldNode.children = [textNode1, textNode2, textNode3];
      root.children = [boldNode];

      const result = remover.splitFormattingNodeAtBoundaries(boldNode, [textNode2]);

      // Should have two new bold nodes (before and after) and textNode2 directly under root
      expect(result.length).toBe(3);
      expect(textNode2.parent).toBe(root);

      // Find the new formatting nodes in the result
      const newBoldNodes = result.filter(node => isFormattingNode(node));
      expect(newBoldNodes.length).toBe(2);

      // Check the first formatting node (should contain textNode1)
      const beforeBoldNode = newBoldNodes.find(node => 
        isFormattingNode(node) && node.children.includes(textNode1)
      );
      expect(beforeBoldNode).toBeDefined();
      if (beforeBoldNode && isFormattingNode(beforeBoldNode)) {
        expect(beforeBoldNode.formatType).toBe('bold');
        expect(beforeBoldNode.children).toEqual([textNode1]);
        expect(textNode1.parent).toBe(beforeBoldNode);
      }

      // Check the second formatting node (should contain textNode3)
      const afterBoldNode = newBoldNodes.find(node => 
        isFormattingNode(node) && node.children.includes(textNode3)
      );
      expect(afterBoldNode).toBeDefined();
      if (afterBoldNode && isFormattingNode(afterBoldNode)) {
        expect(afterBoldNode.formatType).toBe('bold');
        expect(afterBoldNode.children).toEqual([textNode3]);
        expect(textNode3.parent).toBe(afterBoldNode);
      }

      // Check the root's children
      expect(root.children.length).toBe(3);
      expect(root.children).toContain(textNode2);
      expect(root.children).toContain(beforeBoldNode);
      expect(root.children).toContain(afterBoldNode);
    });

    it('should handle the case where the node is not found in parent children', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      // Setup parent-child relationships but don't add boldNode to root.children
      boldNode.parent = root;
      textNode.parent = boldNode;
      boldNode.children = [textNode];
      root.children = []; // Empty children array

      const result = remover.splitFormattingNodeAtBoundaries(boldNode, [textNode]);

      // Should return the original node since it's not found in parent's children
      expect(result).toEqual([boldNode]);
    });
  });
});
