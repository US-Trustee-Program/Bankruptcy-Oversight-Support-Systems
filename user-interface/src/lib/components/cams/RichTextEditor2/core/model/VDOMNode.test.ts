import { test, expect, beforeEach, vi } from 'vitest';
import { VDOMNode, VDOMNodeType } from '../types';
import { ZERO_WIDTH_SPACE } from '../../RichTextEditor.constants';
import {
  createTextNode,
  createElementNode,
  createParagraphNode,
  createEmptyParagraphNode,
  createStrongNode,
  createEmNode,
  createUNode,
  createListNode,
  createListItemNode,
  createBreakNode,
  generateNodeId,
} from './VDOMNode';

beforeEach(() => {
  vi.restoreAllMocks();
});

test('generateNodeId should create unique IDs', () => {
  const id1 = generateNodeId();
  const id2 = generateNodeId();

  expect(id1).toBeTruthy();
  expect(id2).toBeTruthy();
  expect(id1).not.toBe(id2);
  expect(typeof id1).toBe('string');
  expect(typeof id2).toBe('string');
});

test('createTextNode should create a text node with content', () => {
  const content = 'Hello world';
  const node = createTextNode(content);

  expect(node.type).toBe('text');
  expect(node.content).toBe(content);
  expect(node.id).toBeTruthy();
  expect(node.children).toBeUndefined();
  expect(node.attributes).toBeUndefined();
});

test('createTextNode should create empty text node when no content provided', () => {
  const node = createTextNode();

  expect(node.type).toBe('text');
  expect(node.content).toBe('');
  expect(node.id).toBeTruthy();
});

test('createElementNode should create an element node with specified type', () => {
  const type: VDOMNodeType = 'strong';
  const children: VDOMNode[] = [createTextNode('bold text')];
  const attributes = { class: 'test-class' };

  const node = createElementNode(type, children, attributes);

  expect(node.type).toBe(type);
  expect(node.children).toBe(children);
  expect(node.attributes).toBe(attributes);
  expect(node.id).toBeTruthy();
  expect(node.content).toBeUndefined();
});

test('createElementNode should work without children and attributes', () => {
  const type: VDOMNodeType = 'paragraph';
  const node = createElementNode(type);

  expect(node.type).toBe(type);
  expect(node.children).toEqual([]);
  expect(node.attributes).toBeUndefined();
  expect(node.id).toBeTruthy();
});

test('createParagraphNode should create a paragraph with children', () => {
  const children = [createTextNode('paragraph content')];
  const node = createParagraphNode(children);

  expect(node.type).toBe('paragraph');
  expect(node.children).toBe(children);
  expect(node.id).toBeTruthy();
});

test('createParagraphNode should create empty paragraph when no children provided', () => {
  const node = createParagraphNode();

  expect(node.type).toBe('paragraph');
  expect(node.children).toEqual([]);
  expect(node.id).toBeTruthy();
});

test('createEmptyParagraphNode should create paragraph with zero-width space', () => {
  const node = createEmptyParagraphNode();

  expect(node.type).toBe('paragraph');
  expect(node.children).toHaveLength(1);
  expect(node.children![0].type).toBe('text');
  expect(node.children![0].content).toBe(ZERO_WIDTH_SPACE);
  expect(node.id).toBeTruthy();
});

test('createStrongNode should create a strong element', () => {
  const children = [createTextNode('bold text')];
  const node = createStrongNode(children);

  expect(node.type).toBe('strong');
  expect(node.children).toBe(children);
  expect(node.id).toBeTruthy();
});

test('createEmNode should create an em element', () => {
  const children = [createTextNode('italic text')];
  const node = createEmNode(children);

  expect(node.type).toBe('em');
  expect(node.children).toBe(children);
  expect(node.id).toBeTruthy();
});

test('createUNode should create an u element', () => {
  const children = [createTextNode('underlined text')];
  const node = createUNode(children);

  expect(node.type).toBe('u');
  expect(node.children).toBe(children);
  expect(node.id).toBeTruthy();
});

test('createListNode should create ul list by default', () => {
  const children = [createListItemNode([createTextNode('item 1')])];
  const node = createListNode(children);

  expect(node.type).toBe('ul');
  expect(node.children).toBe(children);
  expect(node.id).toBeTruthy();
});

test('createListNode should create ol list when specified', () => {
  const children = [createListItemNode([createTextNode('item 1')])];
  const node = createListNode(children, 'ol');

  expect(node.type).toBe('ol');
  expect(node.children).toBe(children);
  expect(node.id).toBeTruthy();
});

test('createListItemNode should create a list item', () => {
  const children = [createTextNode('list item content')];
  const node = createListItemNode(children);

  expect(node.type).toBe('li');
  expect(node.children).toBe(children);
  expect(node.id).toBeTruthy();
});

test('createBreakNode should create a br element', () => {
  const node = createBreakNode();

  expect(node.type).toBe('br');
  expect(node.children).toEqual([]);
  expect(node.content).toBeUndefined();
  expect(node.id).toBeTruthy();
});

test('all factory functions should generate unique IDs', () => {
  const nodes = [
    createTextNode('text'),
    createParagraphNode(),
    createStrongNode(),
    createEmNode(),
    createUNode(),
    createListNode(),
    createListItemNode(),
    createBreakNode(),
  ];

  const ids = nodes.map((node) => node.id);
  const uniqueIds = new Set(ids);

  expect(uniqueIds.size).toBe(ids.length);
});
