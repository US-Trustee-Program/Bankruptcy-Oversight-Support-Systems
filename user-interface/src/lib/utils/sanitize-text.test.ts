import type { Config, RemovedElement } from 'dompurify';

import DOMPurify from 'dompurify';
import { beforeEach, describe, expect, vi } from 'vitest';

import { sanitizeText } from './sanitize-text';

// Mock document.createElement
const mockElement = {
  addEventListener: vi.fn(),
  appendChild: vi.fn(),
  baseURI: '',
  childNodes: [],
  cloneNode: vi.fn(),
  compareDocumentPosition: vi.fn(),
  contains: vi.fn(),
  dispatchEvent: vi.fn(),
  firstChild: null,
  getRootNode: vi.fn(),
  hasChildNodes: vi.fn(),
  insertBefore: vi.fn(),
  isConnected: false,
  isDefaultNamespace: vi.fn(),
  isEqualNode: vi.fn(),
  isSameNode: vi.fn(),
  lookupNamespaceURI: vi.fn(),
  lookupPrefix: vi.fn(),
  nodeName: 'SCRIPT',
  nodeType: 1,
  nodeValue: null,
  normalize: vi.fn(),
  parentNode: null,
  removeChild: vi.fn(),
  removeEventListener: vi.fn(),
  replaceChild: vi.fn(),
  tagName: 'script',
  textContent: '',
} as unknown as Element;

vi.stubGlobal('document', {
  createElement: vi.fn().mockReturnValue(mockElement),
});

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    removed: [] as RemovedElement[],
    sanitize: vi.fn(),
  },
}));

// Mock useAppInsights
const mockTrackEvent = vi.fn();
vi.mock('../hooks/UseApplicationInsights', () => ({
  useAppInsights: () => ({
    appInsights: {
      trackEvent: mockTrackEvent,
    },
  }),
}));

// Mock LocalStorage
vi.mock('./local-storage', () => ({
  default: {
    getSession: () => ({
      user: { name: 'test-user' },
    }),
  },
}));

describe('sanitizeText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset DOMPurify.removed array
    DOMPurify.removed = [];
  });

  test('should return sanitized text when no malicious content is present', () => {
    const input = 'Safe text content';
    const sanitized = 'Safe text content';
    (DOMPurify.sanitize as jest.Mock).mockReturnValue(sanitized);

    const result = sanitizeText(input);

    expect(DOMPurify.sanitize).toHaveBeenCalledWith(input, expect.any(Object));
    expect(result).toBe(sanitized);
  });

  test('should track event when malicious content is removed', () => {
    const input = '<script>alert("malicious")</script>';
    const sanitized = '';
    (DOMPurify.sanitize as jest.Mock).mockReturnValue(sanitized);
    DOMPurify.removed = [{ element: mockElement } as RemovedElement];

    sanitizeText(input);

    expect(mockTrackEvent).toHaveBeenCalledWith({
      name: 'Malicious text entry found',
      properties: {
        user: { name: 'test-user' },
      },
    });
  });

  test('should not track event when no malicious content is removed', () => {
    const input = 'Safe text content';
    const sanitized = 'Safe text content';
    (DOMPurify.sanitize as jest.Mock).mockReturnValue(sanitized);
    DOMPurify.removed = [];

    sanitizeText(input);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test('should use custom configuration when provided', () => {
    const input = 'Test content';
    const customConfig: Partial<Config> = { ALLOWED_TAGS: ['b', 'i'] };
    (DOMPurify.sanitize as jest.Mock).mockReturnValue(input);

    sanitizeText(input, customConfig);

    expect(DOMPurify.sanitize).toHaveBeenCalledWith(input, expect.objectContaining(customConfig));
  });

  test('should handle empty string input', () => {
    const input = '';
    const sanitized = '';
    (DOMPurify.sanitize as jest.Mock).mockReturnValue(sanitized);

    const result = sanitizeText(input);

    expect(result).toBe(sanitized);
  });
});
