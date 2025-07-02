import { test, expect, beforeEach, vi } from 'vitest';
import { VDOMNode, VDOMSelection } from '../types';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';
import {
  createTextNode,
  createParagraphNode,
  createEmptyParagraphNode,
  createStrongNode,
} from './VDOMNode';
import {
  insertText,
  deleteContent,
  splitNode,
  mergeNodes,
  findNodeById,
  getTextLength,
} from './VDOMMutations';

beforeEach(() => {
  vi.restoreAllMocks();
});

// Helper function to create a simple VDOM structure for testing
function createSimpleVDOM(): VDOMNode[] {
  return [
    createParagraphNode([
      createTextNode('Hello '),
      createStrongNode([createTextNode('world')]),
      createTextNode('!'),
    ]),
  ];
}

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

test('findNodeById should find a node by its ID', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];

  const found = findNodeById(vdom, textNode.id);
  expect(found).toBe(textNode);
});

test('findNodeById should return null for non-existent ID', () => {
  const vdom = createSimpleVDOM();

  const found = findNodeById(vdom, 'non-existent-id');
  expect(found).toBeNull();
});

test('getTextLength should return correct length for text node', () => {
  const textNode = createTextNode('Hello world');
  expect(getTextLength(textNode)).toBe(11);
});

test('getTextLength should return 0 for non-text node', () => {
  const paragraphNode = createParagraphNode();
  expect(getTextLength(paragraphNode)).toBe(0);
});

test('getTextLength should handle empty text node', () => {
  const textNode = createTextNode('');
  expect(getTextLength(textNode)).toBe(0);
});

test('insertText should insert text at the beginning of a text node', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 0, textNode.id, 0);

  const result = insertText(vdom, selection, 'Hi ');

  expect(result.newVDOM).toHaveLength(1);
  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Hi Hello ');
  expect(result.newSelection.start.offset).toBe(3);
  expect(result.newSelection.isCollapsed).toBe(true);
});

test('insertText should insert text in the middle of a text node', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 3, textNode.id, 3);

  const result = insertText(vdom, selection, 'there ');

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Helthere lo ');
  expect(result.newSelection.start.offset).toBe(9);
});

test('insertText should insert text at the end of a text node', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(
    textNode.id,
    textNode.content!.length,
    textNode.id,
    textNode.content!.length,
  );

  const result = insertText(vdom, selection, 'there ');

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Hello there ');
  expect(result.newSelection.start.offset).toBe(12);
});

test('insertText should replace selected text', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 0, textNode.id, 5);

  const result = insertText(vdom, selection, 'Hi');

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Hi ');
  expect(result.newSelection.start.offset).toBe(2);
});

test('insertText should handle empty paragraph with zero-width space', () => {
  const vdom = [createEmptyParagraphNode()];
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 0, textNode.id, 1);

  const result = insertText(vdom, selection, 'Hello');

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Hello');
  expect(result.newSelection.start.offset).toBe(5);
});

test('deleteContent should delete characters from a text node', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 0, textNode.id, 3);

  const result = deleteContent(vdom, selection);

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('lo ');
  expect(result.newSelection.start.offset).toBe(0);
  expect(result.newSelection.isCollapsed).toBe(true);
});

test('deleteContent should handle deleting entire text node content', () => {
  const vdom = [createParagraphNode([createTextNode('Hello')])];
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 0, textNode.id, 5);

  const result = deleteContent(vdom, selection);

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe(ZERO_WIDTH_SPACE);
  expect(result.newSelection.start.offset).toBe(0);
});

test('deleteContent should handle collapsed selection (backspace behavior)', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 3, textNode.id, 3);

  const result = deleteContent(vdom, selection);

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Helo ');
  expect(result.newSelection.start.offset).toBe(2);
});

test('deleteContent should not delete when at beginning of text with collapsed selection', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode.id, 0, textNode.id, 0);

  const result = deleteContent(vdom, selection);

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Hello ');
  expect(result.newSelection.start.offset).toBe(0);
});

test('splitNode should split a text node at the specified position', () => {
  const vdom = [createParagraphNode([createTextNode('Hello world')])];
  const textNode = vdom[0].children![0];
  const position = { nodeId: textNode.id, offset: 6 };

  const result = splitNode(vdom, position);

  expect(result.newVDOM[0].children).toHaveLength(2);
  expect(result.newVDOM[0].children![0].content).toBe('Hello ');
  expect(result.newVDOM[0].children![1].content).toBe('world');
  expect(result.newSelection.start.nodeId).toBe(result.newVDOM[0].children![1].id);
  expect(result.newSelection.start.offset).toBe(0);
});

test('splitNode should handle splitting at the beginning', () => {
  const vdom = [createParagraphNode([createTextNode('Hello')])];
  const textNode = vdom[0].children![0];
  const position = { nodeId: textNode.id, offset: 0 };

  const result = splitNode(vdom, position);

  expect(result.newVDOM[0].children).toHaveLength(2);
  expect(result.newVDOM[0].children![0].content).toBe('');
  expect(result.newVDOM[0].children![1].content).toBe('Hello');
});

test('splitNode should handle splitting at the end', () => {
  const vdom = [createParagraphNode([createTextNode('Hello')])];
  const textNode = vdom[0].children![0];
  const position = { nodeId: textNode.id, offset: 5 };

  const result = splitNode(vdom, position);

  expect(result.newVDOM[0].children).toHaveLength(2);
  expect(result.newVDOM[0].children![0].content).toBe('Hello');
  expect(result.newVDOM[0].children![1].content).toBe('');
});

test('mergeNodes should merge two adjacent text nodes', () => {
  const vdom = [createParagraphNode([createTextNode('Hello '), createTextNode('world')])];
  const firstNode = vdom[0].children![0];
  const secondNode = vdom[0].children![1];

  const result = mergeNodes(vdom, firstNode.id, secondNode.id);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello world');
  expect(result.newSelection.start.offset).toBe(6); // Position where merge occurred
});

test('mergeNodes should handle merging empty text nodes', () => {
  const vdom = [createParagraphNode([createTextNode(''), createTextNode('Hello')])];
  const firstNode = vdom[0].children![0];
  const secondNode = vdom[0].children![1];

  const result = mergeNodes(vdom, firstNode.id, secondNode.id);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello');
  expect(result.newSelection.start.offset).toBe(0);
});

test('mergeNodes should handle merging with zero-width space', () => {
  const vdom = [createParagraphNode([createTextNode(ZERO_WIDTH_SPACE), createTextNode('Hello')])];
  const firstNode = vdom[0].children![0];
  const secondNode = vdom[0].children![1];

  const result = mergeNodes(vdom, firstNode.id, secondNode.id);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello');
  expect(result.newSelection.start.offset).toBe(0);
});
