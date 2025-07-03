import { describe, test, expect } from 'vitest';
import { vdomToHTML } from './VDOMToHTML';
import {
  createTextNode,
  createParagraphNode,
  createStrongNode,
  createEmNode,
  createUNode,
  createBreakNode,
} from '../model/VDOMNode';

describe('vdomToHTML', () => {
  test('should convert empty array to empty string', () => {
    expect(vdomToHTML([])).toBe('');
  });

  test('should convert a text node to plain text', () => {
    const vdom = [createTextNode('Hello, World!')];
    expect(vdomToHTML(vdom)).toBe('Hello, World!');
  });

  test('should convert a paragraph node with text to HTML paragraph', () => {
    const vdom = [createParagraphNode([createTextNode('Hello, World!')])];
    expect(vdomToHTML(vdom)).toBe('<p>Hello, World!</p>');
  });

  test('should convert nested formatting elements', () => {
    const vdom = [
      createParagraphNode([
        createTextNode('Hello, '),
        createStrongNode([createTextNode('bold')]),
        createTextNode(' and '),
        createEmNode([createTextNode('italic')]),
        createTextNode(' and '),
        createUNode([createTextNode('underlined')]),
        createTextNode(' text!'),
      ]),
    ];
    expect(vdomToHTML(vdom)).toBe(
      '<p>Hello, <strong>bold</strong> and <em>italic</em> and <u>underlined</u> text!</p>',
    );
  });

  test('should handle br elements correctly', () => {
    const vdom = [
      createParagraphNode([createTextNode('Line 1'), createBreakNode(), createTextNode('Line 2')]),
    ];
    expect(vdomToHTML(vdom)).toBe('<p>Line 1<br>Line 2</p>');
  });
});
