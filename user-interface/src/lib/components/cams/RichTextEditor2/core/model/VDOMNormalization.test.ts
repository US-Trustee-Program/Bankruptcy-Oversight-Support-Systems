import { test, expect, beforeEach, vi } from 'vitest';
import { VDOMNode, VDOMSelection } from '../types';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';
import { createTextNode, createParagraphNode, createStrongNode, createEmNode } from './VDOMNode';
import {
  normalizeVDOM,
  removeEmptyNodes,
  mergeAdjacentTextNodes,
  ensureEmptyParagraphsHaveZWS,
  removeRedundantFormatting,
  validateVDOMStructure,
} from './VDOMNormalization';

beforeEach(() => {
  vi.restoreAllMocks();
});

// Helper function to create a selection
function createSelection(
  startNodeId: string,
  startOffset: number,
  endNodeId: string,
  endOffset: number,
): VDOMSelection {
  return {
    start: { nodeId: startNodeId, offset: startOffset },
    end: { nodeId: endNodeId, offset: endOffset },
    isCollapsed: startNodeId === endNodeId && startOffset === endOffset,
  };
}

test('normalizeVDOM should ensure empty paragraphs have zero-width space', () => {
  const vdom = [createParagraphNode([])];

  const result = normalizeVDOM(vdom);

  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].type).toBe('text');
  expect(result.newVDOM[0].children![0].content).toBe(ZERO_WIDTH_SPACE);
});

test('normalizeVDOM should preserve non-empty paragraphs', () => {
  const vdom = [createParagraphNode([createTextNode('Hello world')])];

  const result = normalizeVDOM(vdom);

  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello world');
});

test('normalizeVDOM should merge adjacent text nodes', () => {
  const vdom = [
    createParagraphNode([createTextNode('Hello '), createTextNode('world'), createTextNode('!')]),
  ];

  const result = normalizeVDOM(vdom);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello world!');
});

test('normalizeVDOM should remove empty formatting nodes', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([]), // Empty strong node
      createTextNode('world'),
    ]),
  ];

  const result = normalizeVDOM(vdom);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello world');
});

test('normalizeVDOM should remove formatting nodes with only empty text', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([createTextNode('')]), // Strong node with empty text
      createTextNode('world'),
    ]),
  ];

  const result = normalizeVDOM(vdom);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello world');
});

test('normalizeVDOM should preserve formatting nodes with content', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([createTextNode('bold')]),
      createTextNode(' world'),
    ]),
  ];

  const result = normalizeVDOM(vdom);

  expect(result.newVDOM[0].children).toHaveLength(3);
  expect(result.newVDOM[0].children![0].content).toBe('Hello ');
  expect(result.newVDOM[0].children![1].type).toBe('strong');
  expect(result.newVDOM[0].children![1].children![0].content).toBe('bold');
  expect(result.newVDOM[0].children![2].content).toBe(' world');
});

test('normalizeVDOM should handle nested formatting', () => {
  const vdom = [
    createParagraphNode([createStrongNode([createEmNode([createTextNode('nested formatting')])])]),
  ];

  const result = normalizeVDOM(vdom);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].type).toBe('strong');
  expect(result.newVDOM[0].children![0].children![0].type).toBe('em');
  expect(result.newVDOM[0].children![0].children![0].children![0].content).toBe(
    'nested formatting',
  );
});

test('normalizeVDOM should update selection when nodes are merged', () => {
  const textNode1 = createTextNode('Hello ');
  const textNode2 = createTextNode('world');
  const vdom = [createParagraphNode([textNode1, textNode2])];
  const selection = createSelection(textNode2.id, 2, textNode2.id, 2);

  const result = normalizeVDOM(vdom, selection);

  // Selection should be updated to point to the merged node
  expect(result.newSelection.start.offset).toBe(8); // 6 (Hello ) + 2 (wo)
  expect(result.newSelection.end.offset).toBe(8);
});

test('ensureEmptyParagraphsHaveZWS should add ZWS to empty paragraphs', () => {
  const vdom = [createParagraphNode([]), createParagraphNode([createTextNode('Not empty')])];

  const result = ensureEmptyParagraphsHaveZWS(vdom);

  expect(result[0].children).toHaveLength(1);
  expect(result[0].children![0].content).toBe(ZERO_WIDTH_SPACE);
  expect(result[1].children![0].content).toBe('Not empty');
});

test('ensureEmptyParagraphsHaveZWS should handle paragraphs with only whitespace', () => {
  const vdom = [createParagraphNode([createTextNode('   ')])];

  const result = ensureEmptyParagraphsHaveZWS(vdom);

  expect(result[0].children).toHaveLength(1);
  expect(result[0].children![0].content).toBe(ZERO_WIDTH_SPACE);
});

test('mergeAdjacentTextNodes should merge consecutive text nodes', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createTextNode('beautiful '),
      createTextNode('world'),
    ]),
  ];

  const result = mergeAdjacentTextNodes(vdom);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello beautiful world');
});

test('mergeAdjacentTextNodes should not merge text nodes separated by formatting', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([createTextNode('bold')]),
      createTextNode(' world'),
    ]),
  ];

  const result = mergeAdjacentTextNodes(vdom);

  expect(result.newVDOM[0].children).toHaveLength(3);
  expect(result.newVDOM[0].children![0].content).toBe('Hello ');
  expect(result.newVDOM[0].children![1].type).toBe('strong');
  expect(result.newVDOM[0].children![2].content).toBe(' world');
});

test('mergeAdjacentTextNodes should update selection correctly', () => {
  const textNode1 = createTextNode('Hello ');
  const textNode2 = createTextNode('world');
  const vdom = [createParagraphNode([textNode1, textNode2])];
  const selection = createSelection(textNode2.id, 3, textNode2.id, 5);

  const result = mergeAdjacentTextNodes(vdom, selection);

  // Selection should be updated to reflect the merged node
  expect(result.newSelection.start.offset).toBe(9); // 6 + 3
  expect(result.newSelection.end.offset).toBe(11); // 6 + 5
});

test('removeEmptyNodes should remove nodes without content', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello'),
      createStrongNode([]), // Empty
      createEmNode([createTextNode('')]), // Empty text
      createTextNode('world'),
    ]),
  ];

  const result = removeEmptyNodes(vdom);

  expect(result[0].children).toHaveLength(2);
  expect(result[0].children![0].content).toBe('Hello');
  expect(result[0].children![1].content).toBe('world');
});

test('removeEmptyNodes should preserve nodes with meaningful content', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([createTextNode('bold')]),
      createEmNode([createTextNode('italic')]),
      createTextNode(' world'),
    ]),
  ];

  const result = removeEmptyNodes(vdom);

  expect(result[0].children).toHaveLength(4);
});

test('removeRedundantFormatting should remove nested identical formatting', () => {
  const vdom = [
    createParagraphNode([createStrongNode([createStrongNode([createTextNode('double bold')])])]),
  ];

  const result = removeRedundantFormatting(vdom);

  expect(result[0].children).toHaveLength(1);
  expect(result[0].children![0].type).toBe('strong');
  expect(result[0].children![0].children).toHaveLength(1);
  expect(result[0].children![0].children![0].type).toBe('text');
  expect(result[0].children![0].children![0].content).toBe('double bold');
});

test('removeRedundantFormatting should preserve different nested formatting', () => {
  const vdom = [
    createParagraphNode([createStrongNode([createEmNode([createTextNode('bold italic')])])]),
  ];

  const result = removeRedundantFormatting(vdom);

  expect(result[0].children![0].type).toBe('strong');
  expect(result[0].children![0].children![0].type).toBe('em');
  expect(result[0].children![0].children![0].children![0].content).toBe('bold italic');
});

test('validateVDOMStructure should return true for valid structure', () => {
  const vdom = [
    createParagraphNode([createTextNode('Hello '), createStrongNode([createTextNode('world')])]),
  ];

  const isValid = validateVDOMStructure(vdom);

  expect(isValid).toBe(true);
});

test('validateVDOMStructure should return false for invalid structure', () => {
  // Create an invalid structure (paragraph inside paragraph)
  const invalidVDOM = [
    createParagraphNode([createParagraphNode([createTextNode('Invalid nesting')])]),
  ];

  const isValid = validateVDOMStructure(invalidVDOM);

  expect(isValid).toBe(false);
});

test('normalizeVDOM should handle complex mixed content', () => {
  const vdom = [
    createParagraphNode([
      createTextNode(''),
      createTextNode('Hello '),
      createStrongNode([]),
      createTextNode(''),
      createEmNode([createTextNode('italic')]),
      createTextNode(' '),
      createTextNode('world'),
      createStrongNode([createTextNode('')]),
    ]),
  ];

  const result = normalizeVDOM(vdom);

  // Should merge adjacent text nodes and remove empty formatting
  expect(result.newVDOM[0].children).toHaveLength(3);
  expect(result.newVDOM[0].children![0].content).toBe('Hello ');
  expect(result.newVDOM[0].children![1].type).toBe('em');
  expect(result.newVDOM[0].children![1].children![0].content).toBe('italic');
  expect(result.newVDOM[0].children![2].content).toBe(' world');
});

test('normalizeVDOM should ensure at least one paragraph exists', () => {
  const vdom: VDOMNode[] = [];

  const result = normalizeVDOM(vdom);

  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].type).toBe('paragraph');
  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe(ZERO_WIDTH_SPACE);
});
