import { test, expect, describe } from 'vitest';
import { VDOMNode } from '../types';
import { createTextNode, createParagraphNode, createStrongNode, createEmNode } from './VDOMNode';
import { getFormattingAtSelection, getNodeFormatState } from './VDOMFormatting';

describe('VDOMFormatting', () => {
  describe('getNodeFormatState', () => {
    test('should detect bold formatting on a strong node', () => {
      // Arrange
      const strongNode = createStrongNode([createTextNode('bold text')]);

      // Act
      const result = getNodeFormatState(strongNode);

      // Assert
      expect(result.bold).toBe('active');
      expect(result.italic).toBeUndefined();
      expect(result.underline).toBeUndefined();
    });

    test('should detect italic formatting on an em node', () => {
      // Arrange
      const emNode = createEmNode([createTextNode('italic text')]);

      // Act
      const result = getNodeFormatState(emNode);

      // Assert
      expect(result.bold).toBeUndefined();
      expect(result.italic).toBe('active');
      expect(result.underline).toBeUndefined();
    });

    test('should detect underline formatting on a u node', () => {
      // Arrange
      const node: VDOMNode = {
        id: '1',
        type: 'u',
        children: [
          {
            id: '2',
            type: 'text',
            content: 'Underlined text',
          },
        ],
      };

      // Act
      const result = getNodeFormatState(node);

      // Assert
      expect(result.underline).toBe('active');
      expect(result.bold).toBeUndefined();
      expect(result.italic).toBeUndefined();
    });

    test('should not detect any formatting on a text node', () => {
      // Arrange
      const textNode = createTextNode('plain text');

      // Act
      const result = getNodeFormatState(textNode);

      // Assert
      expect(result.bold).toBeUndefined();
      expect(result.italic).toBeUndefined();
      expect(result.underline).toBeUndefined();
    });

    test('should not detect any formatting on a paragraph node', () => {
      // Arrange
      const paragraphNode = createParagraphNode([createTextNode('plain text')]);

      // Act
      const result = getNodeFormatState(paragraphNode);

      // Assert
      expect(result.bold).toBeUndefined();
      expect(result.italic).toBeUndefined();
      expect(result.underline).toBeUndefined();
    });
  });

  describe('getFormattingAtSelection', () => {
    test('should return all inactive when no nodes are selected', () => {
      // Arrange
      const nodes: VDOMNode[] = [];

      // Act
      const result = getFormattingAtSelection(nodes);

      // Assert
      expect(result.bold).toBe('inactive');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should return active for formats that all selected nodes have', () => {
      // Arrange
      const nodes: VDOMNode[] = [
        createStrongNode([createTextNode('bold text')]),
        createStrongNode([createTextNode('more bold text')]),
      ];

      // Act
      const result = getFormattingAtSelection(nodes);

      // Assert
      expect(result.bold).toBe('active');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should return mixed when some nodes have a format and others do not', () => {
      // Arrange
      const nodes: VDOMNode[] = [
        createStrongNode([createTextNode('bold text')]),
        createTextNode('plain text'),
      ];

      // Act
      const result = getFormattingAtSelection(nodes);

      // Assert
      expect(result.bold).toBe('mixed');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });

    test('should return inactive for nodes with no formatting', () => {
      // Arrange
      const nodes: VDOMNode[] = [createTextNode('plain text'), createTextNode('more plain text')];

      // Act
      const result = getFormattingAtSelection(nodes);

      // Assert
      expect(result.bold).toBe('inactive');
      expect(result.italic).toBe('inactive');
      expect(result.underline).toBe('inactive');
    });
  });
});
