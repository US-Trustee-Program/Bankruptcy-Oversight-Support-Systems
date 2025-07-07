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

  describe('whitespace handling', () => {
    test('should preserve single spaces between words unchanged', () => {
      const vdom = [createTextNode('hello world')];
      expect(vdomToHTML(vdom)).toBe('hello world');
    });

    test('should preserve single spaces between multiple words unchanged', () => {
      const vdom = [createTextNode('the quick brown fox')];
      expect(vdomToHTML(vdom)).toBe('the quick brown fox');
    });

    test('should preserve leading single space unchanged', () => {
      const vdom = [createTextNode(' hello')];
      expect(vdomToHTML(vdom)).toBe(' hello');
    });

    test('should preserve leading multiple spaces but convert internal consecutive spaces', () => {
      const vdom = [createTextNode('   hello')];
      expect(vdomToHTML(vdom)).toBe(' &nbsp; hello');
    });

    test('should preserve trailing single space unchanged', () => {
      const vdom = [createTextNode('hello ')];
      expect(vdomToHTML(vdom)).toBe('hello ');
    });

    test('should preserve trailing multiple spaces but convert internal consecutive spaces', () => {
      const vdom = [createTextNode('hello   ')];
      expect(vdomToHTML(vdom)).toBe('hello &nbsp; ');
    });

    test('should convert two consecutive spaces to space + &nbsp;', () => {
      const vdom = [createTextNode('hello  world')];
      expect(vdomToHTML(vdom)).toBe('hello &nbsp;world');
    });

    test('should convert three consecutive spaces to space + &nbsp; + space', () => {
      const vdom = [createTextNode('hello   world')];
      expect(vdomToHTML(vdom)).toBe('hello &nbsp; world');
    });

    test('should convert four consecutive spaces to space + &nbsp; + &nbsp; + space', () => {
      const vdom = [createTextNode('hello    world')];
      expect(vdomToHTML(vdom)).toBe('hello &nbsp;&nbsp; world');
    });

    test('should convert five consecutive spaces to space + &nbsp; + space + &nbsp; + space', () => {
      const vdom = [createTextNode('hello     world')];
      expect(vdomToHTML(vdom)).toBe('hello &nbsp; &nbsp; world');
    });

    test('should handle text that is only spaces', () => {
      const vdom = [createTextNode('   ')];
      expect(vdomToHTML(vdom)).toBe(' &nbsp; ');
    });

    test('should handle single space only text', () => {
      const vdom = [createTextNode(' ')];
      expect(vdomToHTML(vdom)).toBe(' ');
    });

    test('should handle complex mixed whitespace patterns with simplified approach', () => {
      const vdom = [createTextNode('  hello   world  ')];
      expect(vdomToHTML(vdom)).toBe(' &nbsp;hello &nbsp; world &nbsp;');
    });

    test('should handle multiple separate space sequences', () => {
      const vdom = [createTextNode('hello  world  and  more')];
      expect(vdomToHTML(vdom)).toBe('hello &nbsp;world &nbsp;and &nbsp;more');
    });

    test('should handle text with both leading and trailing spaces plus internal spaces', () => {
      const vdom = [createTextNode(' hello  world ')];
      expect(vdomToHTML(vdom)).toBe(' hello &nbsp;world ');
    });

    test('should handle empty string text node', () => {
      const vdom = [createTextNode('')];
      expect(vdomToHTML(vdom)).toBe('');
    });

    test('should handle whitespace in paragraph context with simplified approach', () => {
      const vdom = [createParagraphNode([createTextNode('  hello   world  ')])];
      expect(vdomToHTML(vdom)).toBe('<p> &nbsp;hello &nbsp; world &nbsp;</p>');
    });

    test('should handle whitespace across multiple text nodes in paragraph', () => {
      const vdom = [
        createParagraphNode([
          createTextNode('hello  '),
          createTextNode('  world'),
          createTextNode('   end'),
        ]),
      ];
      expect(vdomToHTML(vdom)).toBe('<p>hello &nbsp; &nbsp;world &nbsp; end</p>');
    });
  });
});
