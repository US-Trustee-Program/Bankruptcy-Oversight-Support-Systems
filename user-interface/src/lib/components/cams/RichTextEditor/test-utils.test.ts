import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import {
  getEditorContent,
  expectEditorContent,
  safelySetTestHtml,
  safelyGetTestHtml,
} from './test-utils';
import { CONTENT_INPUT_SELECTOR } from './editor.constants';

describe('test-utils', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create the container with proper ID
    container = document.createElement('div');
    container.setAttribute('contenteditable', 'true');
    container.id = CONTENT_INPUT_SELECTOR.slice(1); // Remove the # from the selector
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  describe('getEditorContent', () => {
    test('returns editor content element when it exists', () => {
      const content = getEditorContent();
      expect(content).toBe(container);
    });

    test('throws error when editor content element does not exist', () => {
      document.body.removeChild(container);
      expect(() => getEditorContent()).toThrow('Editor content element not found');
    });
  });

  describe('expectEditorContent', () => {
    test('returns editor content element when it exists', () => {
      const content = expectEditorContent();
      expect(content).toBe(container);
    });

    test('throws error when editor content element does not exist', () => {
      document.body.removeChild(container);
      expect(() => expectEditorContent()).toThrow('Editor content element not found');
    });
  });

  describe('safelySetTestHtml', () => {
    test('safely sets HTML content', () => {
      const html = '<p>Test content</p>';
      safelySetTestHtml(container, html);
      expect(container.innerHTML).toBe(html);
    });

    test('sanitizes potentially unsafe HTML', () => {
      const unsafeHtml = '<p>Test<script>alert("xss")</script></p>';
      safelySetTestHtml(container, unsafeHtml);
      expect(container.innerHTML).toBe('<p>Test</p>');
    });

    test('handles empty content', () => {
      safelySetTestHtml(container, '');
      expect(container.innerHTML).toBe('');
    });

    test('preserves safe formatting elements', () => {
      const html = '<p><strong>Bold</strong> and <em>italic</em></p>';
      safelySetTestHtml(container, html);
      expect(container.innerHTML).toBe(html);
    });
  });

  describe('safelyGetTestHtml', () => {
    test('safely gets HTML content', () => {
      const html = '<p>Test content</p>';
      container.innerHTML = html;
      expect(safelyGetTestHtml(container)).toBe(html);
    });

    test('sanitizes potentially unsafe HTML when getting content', () => {
      container.innerHTML = '<p>Test<script>alert("xss")</script></p>';
      expect(safelyGetTestHtml(container)).toBe('<p>Test</p>');
    });

    test('handles empty content', () => {
      container.innerHTML = '';
      expect(safelyGetTestHtml(container)).toBe('');
    });

    test('preserves safe formatting elements when getting content', () => {
      const html = '<p><strong>Bold</strong> and <em>italic</em></p>';
      container.innerHTML = html;
      expect(safelyGetTestHtml(container)).toBe(html);
    });
  });
});
