import { test, expect, beforeEach, vi } from 'vitest';
import DOMPurify from 'dompurify';
import { HtmlCodec } from './HtmlCodec';
import {
  VNodeType,
  type RootNode,
  type TextNode,
  type ElementNode,
  type FormattingNode,
} from './VNode';

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn(),
  },
}));

const mockDOMPurify = vi.mocked(DOMPurify);
const mockSanitize = vi.mocked(DOMPurify.sanitize);

describe('HtmlCodec', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('encode', () => {
    test('should encode a simple text node to HTML', () => {
      const textNode: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 1,
        content: 'Hello',
      };

      const result = HtmlCodec.encode(textNode);
      expect(result).toBe('Hello');
    });

    test('should encode an element node with children to HTML', () => {
      const textNode: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 2,
        content: 'Hello',
      };

      const elementNode: ElementNode = {
        id: 'p-1',
        type: VNodeType.ELEMENT,
        parent: null,
        children: [textNode],
        startOffset: 0,
        endOffset: 5,
        depth: 1,
        tagName: 'p',
        attributes: {},
      };

      textNode.parent = elementNode;

      const result = HtmlCodec.encode(elementNode);
      expect(result).toBe('<p>Hello</p>');
    });

    test('should encode a formatting node to HTML', () => {
      const textNode: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 2,
        content: 'Bold',
      };

      const formattingNode: FormattingNode = {
        id: 'strong-1',
        type: VNodeType.FORMATTING,
        parent: null,
        children: [textNode],
        startOffset: 0,
        endOffset: 4,
        depth: 1,
        formatType: 'bold',
        tagName: 'strong',
      };

      textNode.parent = formattingNode;

      const result = HtmlCodec.encode(formattingNode);
      expect(result).toBe('<strong>Bold</strong>');
    });

    test('should encode element with attributes', () => {
      const textNode: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 4,
        depth: 2,
        content: 'Link',
      };

      const elementNode: ElementNode = {
        id: 'a-1',
        type: VNodeType.ELEMENT,
        parent: null,
        children: [textNode],
        startOffset: 0,
        endOffset: 4,
        depth: 1,
        tagName: 'a',
        attributes: {
          href: 'https://example.com',
          target: '_blank',
        },
      };

      textNode.parent = elementNode;

      const result = HtmlCodec.encode(elementNode);
      expect(result).toBe('<a href="https://example.com" target="_blank">Link</a>');
    });

    test('should encode root node with multiple children', () => {
      const textNode1: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 2,
        content: 'Hello',
      };

      const textNode2: TextNode = {
        id: 'text-2',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 5,
        endOffset: 11,
        depth: 2,
        content: ' World',
      };

      const rootNode: RootNode = {
        id: 'root',
        type: VNodeType.ROOT,
        parent: null,
        children: [textNode1, textNode2],
        startOffset: 0,
        endOffset: 11,
        depth: 0,
      };

      textNode1.parent = rootNode;
      textNode2.parent = rootNode;

      const result = HtmlCodec.encode(rootNode);
      expect(result).toBe('Hello World');
    });
  });

  describe('decode', () => {
    test('should decode simple HTML to VNode tree', () => {
      mockSanitize.mockReturnValue('<p>Hello World</p>');

      const result = HtmlCodec.decode('<p>Hello World</p>');

      expect(mockDOMPurify.sanitize).toHaveBeenCalledWith('<p>Hello World</p>', expect.any(Object));
      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(1);

      const pElement = result.children[0] as ElementNode;
      expect(pElement.type).toBe(VNodeType.ELEMENT);
      expect(pElement.tagName).toBe('p');
      expect(pElement.children).toHaveLength(1);

      const textNode = pElement.children[0] as TextNode;
      expect(textNode.type).toBe(VNodeType.TEXT);
      expect(textNode.content).toBe('Hello World');
    });

    test('should decode HTML with formatting to VNode tree', () => {
      mockSanitize.mockReturnValue('<p><strong>Bold</strong> text</p>');

      const result = HtmlCodec.decode('<p><strong>Bold</strong> text</p>');

      expect(result.type).toBe(VNodeType.ROOT);
      const pElement = result.children[0] as ElementNode;
      expect(pElement.children).toHaveLength(2);

      const strongElement = pElement.children[0] as FormattingNode;
      expect(strongElement.type).toBe(VNodeType.FORMATTING);
      expect(strongElement.formatType).toBe('bold');
      expect(strongElement.tagName).toBe('strong');

      const textInStrong = strongElement.children[0] as TextNode;
      expect(textInStrong.content).toBe('Bold');

      const plainText = pElement.children[1] as TextNode;
      expect(plainText.content).toBe(' text');
    });

    test('should handle empty HTML input', () => {
      mockSanitize.mockReturnValue('');

      const result = HtmlCodec.decode('');

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(0);
    });

    test('should sanitize malicious HTML', () => {
      const maliciousHtml = '<p>Hello <script>alert("xss")</script>World</p>';
      const sanitizedHtml = '<p>Hello World</p>';
      mockSanitize.mockReturnValue(sanitizedHtml);

      const result = HtmlCodec.decode(maliciousHtml);

      expect(mockDOMPurify.sanitize).toHaveBeenCalledWith(maliciousHtml, expect.any(Object));
      expect(result.type).toBe(VNodeType.ROOT);

      const pElement = result.children[0] as ElementNode;
      const textNode = pElement.children[0] as TextNode;
      expect(textNode.content).toBe('Hello World');
    });
  });

  describe('encodeToSafeHtml', () => {
    test('should encode VNode and sanitize the result', () => {
      const textNode: TextNode = {
        id: 'text-1',
        type: VNodeType.TEXT,
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 5,
        depth: 2,
        content: 'Hello',
      };

      const elementNode: ElementNode = {
        id: 'p-1',
        type: VNodeType.ELEMENT,
        parent: null,
        children: [textNode],
        startOffset: 0,
        endOffset: 5,
        depth: 1,
        tagName: 'p',
        attributes: {},
      };

      textNode.parent = elementNode;

      mockSanitize.mockReturnValue('<p>Hello</p>');

      const result = HtmlCodec.encodeToSafeHtml(elementNode);

      expect(mockDOMPurify.sanitize).toHaveBeenCalledWith('<p>Hello</p>', expect.any(Object));
      expect(result).toBe('<p>Hello</p>');
    });
  });

  describe('edge cases for 100% coverage', () => {
    test('should handle text node with null textContent using DOM manipulation', () => {
      // Create a real DOM element and manipulate its textContent to be null
      const tempDiv = document.createElement('div');
      const textNode = document.createTextNode('test');
      tempDiv.appendChild(textNode);

      // Set textContent to null by directly manipulating the property
      Object.defineProperty(textNode, 'textContent', {
        value: null,
        writable: true,
        configurable: true,
      });

      mockSanitize.mockReturnValue('<div></div>');

      // Mock createElement to return our manipulated div
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'div') {
          return tempDiv;
        }
        return originalCreateElement.call(document, tagName);
      });

      const result = HtmlCodec.decode('<div></div>');

      // Restore original createElement
      document.createElement = originalCreateElement;

      expect(result.type).toBe(VNodeType.ROOT);
      // The text node with null content should be skipped
    });

    test('should handle unknown formatting tag by testing getFormatType directly', () => {
      // @ts-expect-error - testing private method
      const getFormatType = HtmlCodec.getFormatType;
      const result = getFormatType('unknown');
      expect(result).toBe(null);
    });

    test('should handle element with attributes to test extractAttributes', () => {
      // Test with an element that has multiple attributes to exercise lines 242-243
      mockSanitize.mockReturnValue(
        '<a href="https://example.com" target="_blank" class="link">Link</a>',
      );

      const result = HtmlCodec.decode(
        '<a href="https://example.com" target="_blank" class="link">Link</a>',
      );

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(1);

      const linkElement = result.children[0] as ElementNode;
      expect(linkElement.type).toBe(VNodeType.ELEMENT);
      expect(linkElement.tagName).toBe('a');
      expect(linkElement.attributes).toEqual({
        href: 'https://example.com',
        target: '_blank',
        class: 'link',
      });
    });

    test('should handle whitespace-only text nodes', () => {
      // Test with whitespace-only text that should be skipped
      mockSanitize.mockReturnValue('<p>   </p>');

      const result = HtmlCodec.decode('<p>   </p>');

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(1);

      const pElement = result.children[0] as ElementNode;
      expect(pElement.children).toHaveLength(0); // The whitespace-only text should be skipped
    });

    test('should handle formatting tag with null formatType', () => {
      // Create a scenario where isFormattingTag returns true but getFormatType returns null
      mockSanitize.mockReturnValue('<custom>Text</custom>');

      // Mock the private methods to simulate the edge case
      // @ts-expect-error - testing private method
      const originalIsFormattingTag = HtmlCodec.isFormattingTag;
      // @ts-expect-error - testing private method
      const originalGetFormatType = HtmlCodec.getFormatType;

      // @ts-expect-error - testing private method
      HtmlCodec.isFormattingTag = vi.fn().mockImplementation((tagName: string) => {
        return tagName === 'custom';
      });
      // @ts-expect-error - testing private method
      HtmlCodec.getFormatType = vi.fn().mockImplementation((tagName: string) => {
        return tagName === 'custom' ? null : originalGetFormatType(tagName);
      });

      const result = HtmlCodec.decode('<custom>Text</custom>');

      // Restore original methods
      // @ts-expect-error - testing private method
      HtmlCodec.isFormattingTag = originalIsFormattingTag;
      // @ts-expect-error - testing private method
      HtmlCodec.getFormatType = originalGetFormatType;

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(1);

      const customElement = result.children[0] as ElementNode;
      expect(customElement.type).toBe(VNodeType.ELEMENT);
      expect(customElement.tagName).toBe('custom');
    });

    test('should throw error for unknown node type', () => {
      const invalidNode = {
        type: 'invalid',
        id: 'test',
        parent: null,
        children: [],
        startOffset: 0,
        endOffset: 0,
        depth: 0,
      } as never;

      expect(() => HtmlCodec.encode(invalidNode)).toThrow('Unknown node type: invalid');
    });

    test('should handle italic formatting with i tag', () => {
      mockSanitize.mockReturnValue('<i>Italic</i>');

      const result = HtmlCodec.decode('<i>Italic</i>');

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(1);

      const italicElement = result.children[0] as FormattingNode;
      expect(italicElement.type).toBe(VNodeType.FORMATTING);
      expect(italicElement.formatType).toBe('italic');
      expect(italicElement.tagName).toBe('i');
    });

    test('should handle underline formatting with u tag', () => {
      mockSanitize.mockReturnValue('<u>Underlined</u>');

      const result = HtmlCodec.decode('<u>Underlined</u>');

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(1);

      const underlineElement = result.children[0] as FormattingNode;
      expect(underlineElement.type).toBe(VNodeType.FORMATTING);
      expect(underlineElement.formatType).toBe('underline');
      expect(underlineElement.tagName).toBe('u');
    });

    test('should handle unknown DOM node type', () => {
      const mockCommentNode = {
        nodeType: Node.COMMENT_NODE,
        textContent: 'comment',
      } as Node;

      mockSanitize.mockReturnValue('<div></div>');

      // Mock createElement to return a div with a comment node
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'div') {
          return {
            innerHTML: '',
            childNodes: [mockCommentNode],
          };
        }
        return originalCreateElement.call(document, tagName);
      });

      const result = HtmlCodec.decode('<div></div>');

      // Restore original createElement
      document.createElement = originalCreateElement;

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(0); // Comment node should be skipped (returns null)
    });

    test('should handle em tag formatting', () => {
      mockSanitize.mockReturnValue('<em>Emphasized</em>');

      const result = HtmlCodec.decode('<em>Emphasized</em>');

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(1);

      const emElement = result.children[0] as FormattingNode;
      expect(emElement.type).toBe(VNodeType.FORMATTING);
      expect(emElement.formatType).toBe('italic');
      expect(emElement.tagName).toBe('em');
    });

    test('should handle text node with undefined textContent', () => {
      // Create a text node with undefined textContent to test the || '' fallback
      const mockTextNode = {
        nodeType: Node.TEXT_NODE,
        textContent: undefined,
      };

      mockSanitize.mockReturnValue('<div></div>');

      // Mock createElement to return a div with the mock text node
      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'div') {
          return {
            innerHTML: '',
            childNodes: [mockTextNode],
          };
        }
        return originalCreateElement.call(document, tagName);
      });

      const result = HtmlCodec.decode('<div></div>');

      // Restore original createElement
      document.createElement = originalCreateElement;

      expect(result.type).toBe(VNodeType.ROOT);
      expect(result.children).toHaveLength(0); // undefined textContent should be treated as empty and skipped
    });
  });
});
