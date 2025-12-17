import { describe, expect, vi, beforeEach, type Mock } from 'vitest';
import { sanitizeText } from './sanitize-text';
import DOMPurify from 'dompurify';
import type { RemovedElement } from 'dompurify';

// Mock document.createElement
const mockElement = {
  tagName: 'script',
  baseURI: '',
  childNodes: [],
  firstChild: null,
  isConnected: false,
  nodeType: 1,
  nodeName: 'SCRIPT',
  nodeValue: null,
  parentNode: null,
  textContent: '',
  appendChild: vi.fn(),
  cloneNode: vi.fn(),
  compareDocumentPosition: vi.fn(),
  contains: vi.fn(),
  getRootNode: vi.fn(),
  hasChildNodes: vi.fn(),
  insertBefore: vi.fn(),
  isDefaultNamespace: vi.fn(),
  isEqualNode: vi.fn(),
  isSameNode: vi.fn(),
  lookupNamespaceURI: vi.fn(),
  lookupPrefix: vi.fn(),
  normalize: vi.fn(),
  removeChild: vi.fn(),
  replaceChild: vi.fn(),
  addEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
  removeEventListener: vi.fn(),
} as unknown as Element;

vi.stubGlobal('document', {
  createElement: vi.fn().mockReturnValue(mockElement),
});

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn(),
    removed: [] as RemovedElement[],
  },
}));

// Mock getAppInsights
const mockTrackEvent = vi.fn();
vi.mock('../hooks/UseApplicationInsights', () => ({
  getAppInsights: () => ({
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
    (DOMPurify.sanitize as Mock).mockReturnValue(sanitized);

    const result = sanitizeText(input);

    expect(DOMPurify.sanitize).toHaveBeenCalledWith(input, expect.any(Object));
    expect(result).toBe(sanitized);
  });

  test('should track event when malicious content is removed', () => {
    const input = '<script>alert("malicious")</script>';
    const sanitized = '';
    (DOMPurify.sanitize as Mock).mockReturnValue(sanitized);
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
    (DOMPurify.sanitize as Mock).mockReturnValue(sanitized);
    DOMPurify.removed = [];

    sanitizeText(input);

    expect(mockTrackEvent).not.toHaveBeenCalled();
  });

  test('should handle empty string input', () => {
    const input = '';
    const sanitized = '';
    (DOMPurify.sanitize as Mock).mockReturnValue(sanitized);

    const result = sanitizeText(input);

    expect(result).toBe(sanitized);
  });
});
