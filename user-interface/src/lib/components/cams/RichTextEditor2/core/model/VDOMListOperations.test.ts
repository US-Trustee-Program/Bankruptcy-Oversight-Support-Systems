import { test, expect, beforeEach, vi } from 'vitest';
import { VDOMSelection } from '../types';
import {
  createTextNode,
  createParagraphNode,
  createListNode,
  createListItemNode,
  createStrongNode,
} from './VDOMNode';
import {
  toggleList,
  convertParagraphToListItem,
  convertListItemToParagraph,
  isInList,
  getListAncestor,
  canToggleList,
} from './VDOMListOperations';

beforeEach(() => {
  vi.restoreAllMocks();
});

// Helper function to create a selection
function createSelection(startOffset: number, endOffset: number): VDOMSelection {
  return {
    start: { offset: startOffset },
    end: { offset: endOffset },
    isCollapsed: startOffset === endOffset,
  };
}

test('toggleList should convert paragraph to unordered list', () => {
  const vdom = [createParagraphNode([createTextNode('List item')])];
  const selection = createSelection(0, 9);

  const result = toggleList(vdom, selection, 'ul');

  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].type).toBe('ul');
  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].type).toBe('li');
  expect(result.newVDOM[0].children![0].children![0].content).toBe('List item');
});

test('toggleList should convert paragraph to ordered list', () => {
  const vdom = [createParagraphNode([createTextNode('Numbered item')])];
  const selection = createSelection(0, 12);

  const result = toggleList(vdom, selection, 'ol');

  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].type).toBe('ol');
  expect(result.newVDOM[0].children).toHaveLength(1);
  expect(result.newVDOM[0].children![0].type).toBe('li');
  expect(result.newVDOM[0].children![0].children![0].content).toBe('Numbered item');
});

test('toggleList should convert list back to paragraph', () => {
  const vdom = [createListNode([createListItemNode([createTextNode('List item')])], 'ul')];
  const selection = createSelection(0, 9);

  const result = toggleList(vdom, selection, 'ul');

  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].type).toBe('paragraph');
  expect(result.newVDOM[0].children![0].content).toBe('List item');
});

test('toggleList should convert between list types', () => {
  const vdom = [createListNode([createListItemNode([createTextNode('List item')])], 'ul')];
  const selection = createSelection(0, 9);

  const result = toggleList(vdom, selection, 'ol');

  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].type).toBe('ol');
  expect(result.newVDOM[0].children![0].type).toBe('li');
  expect(result.newVDOM[0].children![0].children![0].content).toBe('List item');
});

test('toggleList should handle multiple paragraphs', () => {
  const vdom = [
    createParagraphNode([createTextNode('First item')]),
    createParagraphNode([createTextNode('Second item')]),
  ];
  const selection = createSelection(0, 11);

  const result = toggleList(vdom, selection, 'ul');

  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].type).toBe('ul');
  expect(result.newVDOM[0].children).toHaveLength(2);
  expect(result.newVDOM[0].children![0].children![0].content).toBe('First item');
  expect(result.newVDOM[0].children![1].children![0].content).toBe('Second item');
});

test('toggleList should handle formatted text in paragraphs', () => {
  const vdom = [
    createParagraphNode([
      createTextNode('Normal '),
      createStrongNode([createTextNode('bold')]),
      createTextNode(' text'),
    ]),
  ];
  const selection = createSelection(0, 6);

  const result = toggleList(vdom, selection, 'ul');

  expect(result.newVDOM[0].type).toBe('ul');
  expect(result.newVDOM[0].children![0].type).toBe('li');
  expect(result.newVDOM[0].children![0].children).toHaveLength(3);
  expect(result.newVDOM[0].children![0].children![1].type).toBe('strong');
});

test('toggleList should handle collapsed selection in paragraph', () => {
  const vdom = [createParagraphNode([createTextNode('List item')])];
  const selection = createSelection(5, 5);

  const result = toggleList(vdom, selection, 'ul');

  expect(result.newVDOM[0].type).toBe('ul');
  expect(result.newVDOM[0].children![0].type).toBe('li');
  expect(result.newSelection.isCollapsed).toBe(true);
});

test('toggleList should handle collapsed selection in list', () => {
  const vdom = [createListNode([createListItemNode([createTextNode('List item')])], 'ul')];
  const selection = createSelection(5, 5);

  const result = toggleList(vdom, selection, 'ul');

  expect(result.newVDOM[0].type).toBe('paragraph');
  expect(result.newSelection.isCollapsed).toBe(true);
});

test('convertParagraphToListItem should convert paragraph content', () => {
  const paragraph = createParagraphNode([
    createTextNode('Hello '),
    createStrongNode([createTextNode('world')]),
  ]);

  const listItem = convertParagraphToListItem(paragraph);

  expect(listItem.type).toBe('li');
  expect(listItem.children).toHaveLength(2);
  expect(listItem.children![0].content).toBe('Hello ');
  expect(listItem.children![1].type).toBe('strong');
});

test('convertListItemToParagraph should convert list item content', () => {
  const listItem = createListItemNode([
    createTextNode('Hello '),
    createStrongNode([createTextNode('world')]),
  ]);

  const paragraph = convertListItemToParagraph(listItem);

  expect(paragraph.type).toBe('paragraph');
  expect(paragraph.children).toHaveLength(2);
  expect(paragraph.children![0].content).toBe('Hello ');
  expect(paragraph.children![1].type).toBe('strong');
});

test('isInList should detect if selection is within a list', () => {
  const vdom = [createListNode([createListItemNode([createTextNode('List item')])], 'ul')];
  const selection = createSelection(0, 9);

  const inList = isInList(vdom, selection);

  expect(inList).toBe(true);
});

test('isInList should return false for paragraph selection', () => {
  const vdom = [createParagraphNode([createTextNode('Not in list')])];
  const selection = createSelection(0, 11);

  const inList = isInList(vdom, selection);

  expect(inList).toBe(false);
});

test('getListAncestor should find list ancestor', () => {
  const vdom = [createListNode([createListItemNode([createTextNode('List item')])], 'ul')];
  const listAncestor = getListAncestor(vdom);

  expect(listAncestor).toBe(vdom[0]);
  expect(listAncestor?.type).toBe('ul');
});

test('getListAncestor should return null for non-list content', () => {
  const vdom = [createParagraphNode([createTextNode('Not in list')])];
  const listAncestor = getListAncestor(vdom);

  expect(listAncestor).toBeNull();
});

test('canToggleList should return true for valid selections', () => {
  const vdom = [createParagraphNode([createTextNode('Can be list')])];
  const selection = createSelection(0, 11);

  const canToggle = canToggleList(vdom, selection);

  expect(canToggle).toBe(true);
});

test('canToggleList should return true for list selections', () => {
  const vdom = [createListNode([createListItemNode([createTextNode('List item')])], 'ul')];
  const selection = createSelection(0, 9);

  const canToggle = canToggleList(vdom, selection);

  expect(canToggle).toBe(true);
});

test('toggleList should preserve selection position', () => {
  const vdom = [createParagraphNode([createTextNode('List item')])];
  const selection = createSelection(5, 5);

  const result = toggleList(vdom, selection, 'ul');

  expect(result.newSelection.start.offset).toBe(5);
  expect(result.newSelection.end.offset).toBe(5);
  expect(result.newSelection.isCollapsed).toBe(true);
});

test('toggleList should handle mixed content selection', () => {
  const vdom = [
    createParagraphNode([createTextNode('First paragraph')]),
    createListNode([createListItemNode([createTextNode('Existing list item')])], 'ul'),
    createParagraphNode([createTextNode('Second paragraph')]),
  ];
  const selection = createSelection(0, 16);

  const result = toggleList(vdom, selection, 'ul');

  // Should convert all content to a single list
  expect(result.newVDOM).toHaveLength(1);
  expect(result.newVDOM[0].type).toBe('ul');
  expect(result.newVDOM[0].children).toHaveLength(3);
});

test('toggleList should handle empty list items', () => {
  const vdom = [createListNode([createListItemNode([createTextNode('')])], 'ul')];
  const selection = createSelection(0, 0);

  const result = toggleList(vdom, selection, 'ul');

  expect(result.newVDOM[0].type).toBe('paragraph');
  expect(result.newVDOM[0].children![0].content).toBe('');
});
