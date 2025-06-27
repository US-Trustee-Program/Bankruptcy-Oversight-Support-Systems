/**
 * Unit tests for FormattingDetector utility
 */

import { describe, it, expect } from 'vitest';
import { FormattingDetector } from './FormattingDetector';
import {
  createTextNode,
  createFormattingNode,
  createElementNode,
  createRootNode,
} from './virtual-dom/VNodeFactory';

describe('FormattingDetector', () => {
  describe('hasFormatting', () => {
    it('should return false for text nodes without formatting', () => {
      const textNode = createTextNode('Hello world');

      expect(FormattingDetector.hasFormatting(textNode, 'bold')).toBe(false);
      expect(FormattingDetector.hasFormatting(textNode, 'italic')).toBe(false);
      expect(FormattingDetector.hasFormatting(textNode, 'underline')).toBe(false);
    });

    it('should return true for formatting nodes of the specified type', () => {
      const boldNode = createFormattingNode('bold');
      const italicNode = createFormattingNode('italic');
      const underlineNode = createFormattingNode('underline');

      expect(FormattingDetector.hasFormatting(boldNode, 'bold')).toBe(true);
      expect(FormattingDetector.hasFormatting(boldNode, 'italic')).toBe(false);
      expect(FormattingDetector.hasFormatting(boldNode, 'underline')).toBe(false);

      expect(FormattingDetector.hasFormatting(italicNode, 'bold')).toBe(false);
      expect(FormattingDetector.hasFormatting(italicNode, 'italic')).toBe(true);
      expect(FormattingDetector.hasFormatting(italicNode, 'underline')).toBe(false);

      expect(FormattingDetector.hasFormatting(underlineNode, 'bold')).toBe(false);
      expect(FormattingDetector.hasFormatting(underlineNode, 'italic')).toBe(false);
      expect(FormattingDetector.hasFormatting(underlineNode, 'underline')).toBe(true);
    });

    it('should return false for formatting nodes of different types', () => {
      const boldNode = createFormattingNode('bold');

      expect(FormattingDetector.hasFormatting(boldNode, 'italic')).toBe(false);
      expect(FormattingDetector.hasFormatting(boldNode, 'underline')).toBe(false);
    });

    it('should return false for element nodes', () => {
      const elementNode = createElementNode('div', {});

      expect(FormattingDetector.hasFormatting(elementNode, 'bold')).toBe(false);
      expect(FormattingDetector.hasFormatting(elementNode, 'italic')).toBe(false);
      expect(FormattingDetector.hasFormatting(elementNode, 'underline')).toBe(false);
    });
  });

  describe('getAppliedFormats', () => {
    it('should return empty array for text nodes', () => {
      const textNode = createTextNode('Hello world');

      expect(FormattingDetector.getAppliedFormats(textNode)).toEqual([]);
    });

    it('should return the format type for formatting nodes', () => {
      const boldNode = createFormattingNode('bold');
      const italicNode = createFormattingNode('italic');
      const underlineNode = createFormattingNode('underline');

      expect(FormattingDetector.getAppliedFormats(boldNode)).toEqual(['bold']);
      expect(FormattingDetector.getAppliedFormats(italicNode)).toEqual(['italic']);
      expect(FormattingDetector.getAppliedFormats(underlineNode)).toEqual(['underline']);
    });

    it('should return empty array for element nodes', () => {
      const elementNode = createElementNode('div', {});

      expect(FormattingDetector.getAppliedFormats(elementNode)).toEqual([]);
    });
  });

  describe('isDescendantOfFormatting', () => {
    it('should return false for nodes without formatting ancestors', () => {
      const root = createRootNode();
      const textNode = createTextNode('Hello world');

      // Mock parent relationship
      textNode.parent = root;
      root.children = [textNode];

      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'bold')).toBe(false);
      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'italic')).toBe(false);
      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'underline')).toBe(false);
    });

    it('should return true for nodes with direct formatting parent', () => {
      const boldNode = createFormattingNode('bold');
      const textNode = createTextNode('Bold text');

      // Mock parent relationship
      textNode.parent = boldNode;
      boldNode.children = [textNode];

      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'bold')).toBe(true);
      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'italic')).toBe(false);
      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'underline')).toBe(false);
    });

    it('should return true for nodes with indirect formatting ancestors', () => {
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

      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'bold')).toBe(true);
      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'italic')).toBe(true);
      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'underline')).toBe(false);
    });

    it('should return false for root nodes', () => {
      const root = createRootNode();

      expect(FormattingDetector.isDescendantOfFormatting(root, 'bold')).toBe(false);
      expect(FormattingDetector.isDescendantOfFormatting(root, 'italic')).toBe(false);
      expect(FormattingDetector.isDescendantOfFormatting(root, 'underline')).toBe(false);
    });

    it('should handle multiple formatting ancestors correctly', () => {
      const root = createRootNode();
      const boldNode = createFormattingNode('bold');
      const underlineNode = createFormattingNode('underline');
      const textNode = createTextNode('Bold underlined text');

      // Mock nested parent relationships: root -> bold -> underline -> text
      textNode.parent = underlineNode;
      underlineNode.parent = boldNode;
      boldNode.parent = root;
      underlineNode.children = [textNode];
      boldNode.children = [underlineNode];
      root.children = [boldNode];

      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'bold')).toBe(true);
      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'italic')).toBe(false);
      expect(FormattingDetector.isDescendantOfFormatting(textNode, 'underline')).toBe(true);
    });
  });
});
