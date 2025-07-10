import { test, expect, beforeEach, vi } from 'vitest';
import { VDOMNode, VDOMSelection } from '../types';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';
import {
  createTextNode,
  createParagraphNode,
  createEmptyParagraphNode,
  createStrongNode,
} from './VDOMNode';
import { insertText, deleteContent, splitNode, mergeNodes, getTextLength } from './VDOMMutations';

beforeEach(() => {
  vi.restoreAllMocks();
});

// Helper function to create a simple VDOM structure for testing
function createSimpleVDOM(): VDOMNode[] {
  const textNode1 = createTextNode('Hello ');
  textNode1.path = [0, 0];

  const strongTextNode = createTextNode('world');
  strongTextNode.path = [0, 1, 0];

  const strongNode = createStrongNode([strongTextNode]);
  strongNode.path = [0, 1];

  const textNode2 = createTextNode('!');
  textNode2.path = [0, 2];

  const paragraphNode = createParagraphNode([textNode1, strongNode, textNode2]);
  paragraphNode.path = [0];

  return [paragraphNode];
}

// Helper function to create a selection using node references
function createSelection(
  startNode: VDOMNode,
  startOffset: number,
  endNode: VDOMNode,
  endOffset: number,
): VDOMSelection {
  return {
    start: { node: startNode, offset: startOffset },
    end: { node: endNode, offset: endOffset },
    isCollapsed: startNode === endNode && startOffset === endOffset,
  };
}

test('getTextLength should return correct length for text node', () => {
  const textNode = createTextNode('Hello world');
  textNode.path = [0];
  expect(getTextLength(textNode)).toBe(11);
});

test('getTextLength should return 0 for non-text node', () => {
  const paragraphNode = createParagraphNode();
  paragraphNode.path = [0];
  expect(getTextLength(paragraphNode)).toBe(0);
});

test('getTextLength should handle empty text node', () => {
  const textNode = createTextNode('');
  textNode.path = [0];
  expect(getTextLength(textNode)).toBe(0);
});

test('insertText should insert text at the beginning of a text node', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode, 0, textNode, 0);

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
  const selection = createSelection(textNode, 3, textNode, 3);

  const result = insertText(vdom, selection, 'there ');

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Helthere lo ');
  expect(result.newSelection.start.offset).toBe(9);
});

test('insertText should insert text at the end of a text node', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(
    textNode,
    textNode.content!.length,
    textNode,
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
  const selection = createSelection(textNode, 0, textNode, 5);

  const result = insertText(vdom, selection, 'Hi');

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Hi ');
  expect(result.newSelection.start.offset).toBe(2);
});

test('insertText should handle empty paragraph with zero-width space', () => {
  const emptyParagraph = createEmptyParagraphNode();
  emptyParagraph.path = [0];
  emptyParagraph.children![0].path = [0, 0];
  const vdom = [emptyParagraph];
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode, 0, textNode, 1);

  const result = insertText(vdom, selection, 'Hello');

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Hello');
  expect(result.newSelection.start.offset).toBe(5);
});

test('deleteContent should delete characters from a text node', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode, 0, textNode, 3);

  const result = deleteContent(vdom, selection);

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('lo ');
  expect(result.newSelection.start.offset).toBe(0);
  expect(result.newSelection.isCollapsed).toBe(true);
});

test('deleteContent should handle deleting entire text node content', () => {
  const textNode = createTextNode('Hello');
  textNode.path = [0, 0];
  const paragraphNode = createParagraphNode([textNode]);
  paragraphNode.path = [0];
  const vdom = [paragraphNode];
  const selection = createSelection(textNode, 0, textNode, 5);

  const result = deleteContent(vdom, selection);

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe(ZERO_WIDTH_SPACE);
  expect(result.newSelection.start.offset).toBe(0);
});

test('deleteContent should handle collapsed selection (backspace behavior)', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode, 3, textNode, 3);

  const result = deleteContent(vdom, selection);

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Helo ');
  expect(result.newSelection.start.offset).toBe(2);
});

test('deleteContent should not delete when at beginning of text with collapsed selection', () => {
  const vdom = createSimpleVDOM();
  const textNode = vdom[0].children![0];
  const selection = createSelection(textNode, 0, textNode, 0);

  const result = deleteContent(vdom, selection);

  const newTextNode = result.newVDOM[0].children![0];
  expect(newTextNode.content).toBe('Hello ');
  expect(result.newSelection.start.offset).toBe(0);
});

test('splitNode should split a text node at the specified position', () => {
  const textNode = createTextNode('Hello world');
  textNode.path = [0, 0];
  const paragraphNode = createParagraphNode([textNode]);
  paragraphNode.path = [0];
  const vdom = [paragraphNode];
  const position = { node: textNode, offset: 6 };

  const result = splitNode(vdom, position);

  expect(result.newVDOM[0].children).toHaveLength(2);
  expect(result.newVDOM[0].children![0].content).toBe('Hello ');
  expect(result.newVDOM[0].children![1].content).toBe('world');
  expect(result.newSelection.start.node).toBe(result.newVDOM[0].children![1]);
  expect(result.newSelection.start.offset).toBe(0);
});

test('splitNode should handle splitting at the beginning', () => {
  const textNode = createTextNode('Hello');
  textNode.path = [0, 0];
  const paragraphNode = createParagraphNode([textNode]);
  paragraphNode.path = [0];
  const vdom = [paragraphNode];
  const position = { node: textNode, offset: 0 };

  const result = splitNode(vdom, position);

  expect(result.newVDOM[0].children).toHaveLength(2);
  expect(result.newVDOM[0].children![0].content).toBe('');
  expect(result.newVDOM[0].children![1].content).toBe('Hello');
});

test('splitNode should handle splitting at the end', () => {
  const textNode = createTextNode('Hello');
  textNode.path = [0, 0];
  const paragraphNode = createParagraphNode([textNode]);
  paragraphNode.path = [0];
  const vdom = [paragraphNode];
  const position = { node: textNode, offset: 5 };

  const result = splitNode(vdom, position);

  expect(result.newVDOM[0].children).toHaveLength(2);
  expect(result.newVDOM[0].children![0].content).toBe('Hello');
  expect(result.newVDOM[0].children![1].content).toBe('');
});

test('mergeNodes should merge two adjacent text nodes', () => {
  const firstNode = createTextNode('Hello ');
  firstNode.path = [0, 0];
  const secondNode = createTextNode('world');
  secondNode.path = [0, 1];
  const paragraphNode = createParagraphNode([firstNode, secondNode]);
  paragraphNode.path = [0];
  const vdom = [paragraphNode];

  const result = mergeNodes(vdom, firstNode.path, secondNode.path);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello world');
  expect(result.newSelection.start.offset).toBe(6); // Position where merge occurred
});

test('mergeNodes should handle merging empty text nodes', () => {
  const firstNode = createTextNode('');
  firstNode.path = [0, 0];
  const secondNode = createTextNode('Hello');
  secondNode.path = [0, 1];
  const paragraphNode = createParagraphNode([firstNode, secondNode]);
  paragraphNode.path = [0];
  const vdom = [paragraphNode];

  const result = mergeNodes(vdom, firstNode.path, secondNode.path);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello');
  expect(result.newSelection.start.offset).toBe(0);
});

test('mergeNodes should handle merging with zero-width space', () => {
  const firstNode = createTextNode(ZERO_WIDTH_SPACE);
  firstNode.path = [0, 0];
  const secondNode = createTextNode('Hello');
  secondNode.path = [0, 1];
  const paragraphNode = createParagraphNode([firstNode, secondNode]);
  paragraphNode.path = [0];
  const vdom = [paragraphNode];

  const result = mergeNodes(vdom, firstNode.path, secondNode.path);

  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].content).toBe('Hello');
  expect(result.newSelection.start.offset).toBe(0);
});
