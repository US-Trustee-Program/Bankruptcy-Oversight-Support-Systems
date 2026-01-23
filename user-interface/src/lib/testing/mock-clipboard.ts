import { vi } from 'vitest';

interface ClipboardMock {
  mockWrite: ReturnType<typeof vi.fn>;
  mockWriteText: ReturnType<typeof vi.fn>;
  restore: () => void;
}

/**
 * Mock ClipboardItem class for testing (jsdom doesn't provide this).
 */
class MockClipboardItem {
  private data: Record<string, Blob>;
  public types: string[];

  constructor(data: Record<string, Blob>) {
    this.data = data;
    this.types = Object.keys(data);
  }

  async getType(type: string): Promise<Blob> {
    if (!this.data[type]) {
      throw new Error(`Type ${type} not found in ClipboardItem`);
    }
    return this.data[type];
  }
}

/**
 * Creates a mock clipboard with write and writeText methods for testing.
 * Also mocks ClipboardItem which is required for HTML clipboard operations.
 * Automatically restores the original clipboard when restore() is called.
 *
 * @example
 * ```ts
 * const clipboardMock = mockClipboardWrite();
 *
 * // Use in your test
 * await copyHTMLToClipboard('test-class');
 * expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
 *
 * // Clean up
 * clipboardMock.restore();
 * ```
 */
export function mockClipboardWrite(): ClipboardMock {
  const originalClipboard = navigator.clipboard;
  const originalClipboardItem = global.ClipboardItem;
  const mockWrite = vi.fn().mockResolvedValue(undefined);
  const mockWriteText = vi.fn().mockResolvedValue(undefined);

  // Mock ClipboardItem if not available
  if (!global.ClipboardItem) {
    global.ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;
  }

  Object.defineProperty(navigator, 'clipboard', {
    value: {
      write: mockWrite,
      writeText: mockWriteText,
    },
    writable: true,
    configurable: true,
  });

  return {
    mockWrite,
    mockWriteText,
    restore: () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });

      // Restore ClipboardItem
      if (originalClipboardItem) {
        global.ClipboardItem = originalClipboardItem;
      } else {
        delete (global as Record<string, unknown>).ClipboardItem;
      }
    },
  };
}

/**
 * Creates a mock clipboard that rejects operations for testing error handling.
 * Also mocks ClipboardItem which is required for HTML clipboard operations.
 *
 * @param errorMessage - The error message to use for rejections (default: 'Clipboard access denied')
 * @example
 * ```ts
 * const clipboardMock = mockClipboardWriteRejection();
 *
 * // Use in your test
 * await copyHTMLToClipboard('test-class');
 * expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
 *
 * // Clean up
 * clipboardMock.restore();
 * ```
 */
export function mockClipboardWriteRejection(
  errorMessage = 'Clipboard access denied',
): ClipboardMock {
  const originalClipboard = navigator.clipboard;
  const originalClipboardItem = global.ClipboardItem;
  const mockWrite = vi.fn().mockRejectedValue(new Error(errorMessage));
  const mockWriteText = vi.fn().mockRejectedValue(new Error(errorMessage));

  // Mock ClipboardItem if not available
  if (!global.ClipboardItem) {
    global.ClipboardItem = MockClipboardItem as unknown as typeof ClipboardItem;
  }

  Object.defineProperty(navigator, 'clipboard', {
    value: {
      write: mockWrite,
      writeText: mockWriteText,
    },
    writable: true,
    configurable: true,
  });

  return {
    mockWrite,
    mockWriteText,
    restore: () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });

      // Restore ClipboardItem
      if (originalClipboardItem) {
        global.ClipboardItem = originalClipboardItem;
      } else {
        delete (global as Record<string, unknown>).ClipboardItem;
      }
    },
  };
}

/**
 * Creates a mock with undefined clipboard API for testing graceful degradation.
 *
 * @example
 * ```ts
 * const clipboardMock = mockClipboardUndefined();
 *
 * // Use in your test
 * expect(() => copyHTMLToClipboard('test-class')).not.toThrow();
 *
 * // Clean up
 * clipboardMock.restore();
 * ```
 */
export function mockClipboardUndefined(): Pick<ClipboardMock, 'restore'> {
  const originalClipboard = navigator.clipboard;

  Object.defineProperty(navigator, 'clipboard', {
    value: undefined,
    writable: true,
    configurable: true,
  });

  return {
    restore: () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    },
  };
}
