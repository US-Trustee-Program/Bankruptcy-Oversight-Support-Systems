import {
  copyStringToClipboard,
  copyHTMLToClipboard,
  copyElementHTMLToClipboard,
} from './clipBoard';
import {
  mockClipboardWrite,
  mockClipboardWriteRejection,
  mockClipboardUndefined,
} from '@/lib/testing/mock-clipboard';

describe('clipboard utility tests', () => {
  let originalClipboard: Clipboard | undefined;

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
  });

  test('should successfully copy string to clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    const testString = 'test string to copy';
    copyStringToClipboard(testString);

    expect(mockWriteText).toHaveBeenCalledWith(testString);
    expect(mockWriteText).toHaveBeenCalledTimes(1);
  });

  test('should silently handle clipboard write rejection', async () => {
    const mockWriteText = vi.fn().mockRejectedValue(new Error('Clipboard access denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const testString = 'test string';
    copyStringToClipboard(testString);

    expect(mockWriteText).toHaveBeenCalledWith(testString);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should handle undefined clipboard API gracefully', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const testString = 'test string';

    expect(() => copyStringToClipboard(testString)).not.toThrow();

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should handle null clipboard API gracefully', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: null,
      writable: true,
      configurable: true,
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const testString = 'test string';

    expect(() => copyStringToClipboard(testString)).not.toThrow();

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test('should copy empty string to clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    copyStringToClipboard('');

    expect(mockWriteText).toHaveBeenCalledWith('');
  });

  test('should copy multiline string to clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    const multilineString = 'line1\nline2\nline3';
    copyStringToClipboard(multilineString);

    expect(mockWriteText).toHaveBeenCalledWith(multilineString);
  });

  test('should copy special characters to clipboard', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });

    const specialString = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`';
    copyStringToClipboard(specialString);

    expect(mockWriteText).toHaveBeenCalledWith(specialString);
  });
});

describe('copyHTMLToClipboard tests', () => {
  let originalClipboard: Clipboard | undefined;

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('should copy innerHTML by default when element exists', async () => {
    const clipboardMock = mockClipboardWrite();

    const testElement = document.createElement('div');
    testElement.className = 'test-class';
    testElement.innerHTML = '<p>Test content</p>';
    document.body.appendChild(testElement);

    await copyHTMLToClipboard('test-class');

    expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
    const clipboardItem = clipboardMock.mockWrite.mock.calls[0][0][0];
    expect(clipboardItem).toBeInstanceOf(ClipboardItem);

    // Verify both HTML and plain text types are present
    expect(clipboardItem.types).toContain('text/html');
    expect(clipboardItem.types).toContain('text/plain');

    clipboardMock.restore();
  });

  test('should copy outerHTML when inner parameter is false', async () => {
    const clipboardMock = mockClipboardWrite();

    const testElement = document.createElement('div');
    testElement.className = 'test-class';
    testElement.innerHTML = '<p>Test content</p>';
    document.body.appendChild(testElement);

    await copyHTMLToClipboard('test-class', { inner: false });

    expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
    const clipboardItem = clipboardMock.mockWrite.mock.calls[0][0][0];

    // Verify the ClipboardItem was created with both types
    expect(clipboardItem).toBeInstanceOf(ClipboardItem);
    expect(clipboardItem.types).toContain('text/html');
    expect(clipboardItem.types).toContain('text/plain');

    clipboardMock.restore();
  });

  test('should return early when element is not found', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        write: mockWrite,
      },
      writable: true,
      configurable: true,
    });

    await copyHTMLToClipboard('non-existent-class');

    expect(mockWrite).not.toHaveBeenCalled();
  });

  test('should silently handle clipboard write rejection', async () => {
    const clipboardMock = mockClipboardWriteRejection();

    const testElement = document.createElement('div');
    testElement.className = 'test-class';
    testElement.innerHTML = '<p>Test content</p>';
    document.body.appendChild(testElement);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await copyHTMLToClipboard('test-class');

    expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    clipboardMock.restore();
  });

  test('should handle undefined clipboard API gracefully', async () => {
    const clipboardMock = mockClipboardUndefined();

    const testElement = document.createElement('div');
    testElement.className = 'test-class';
    testElement.innerHTML = '<p>Test content</p>';
    document.body.appendChild(testElement);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(copyHTMLToClipboard('test-class')).resolves.not.toThrow();

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    clipboardMock.restore();
  });

  test('should create ClipboardItem with both HTML and plain text types', async () => {
    const clipboardMock = mockClipboardWrite();

    const testElement = document.createElement('div');
    testElement.className = 'test-class';
    testElement.innerHTML = '<p>Line 1</p><p>Line 2</p>';
    document.body.appendChild(testElement);

    await copyHTMLToClipboard('test-class');

    expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
    const clipboardItem = clipboardMock.mockWrite.mock.calls[0][0][0];

    // Verify both HTML and plain text types are present (our code creates Blobs for both)
    expect(clipboardItem).toBeInstanceOf(ClipboardItem);
    expect(clipboardItem.types).toContain('text/html');
    expect(clipboardItem.types).toContain('text/plain');

    clipboardMock.restore();
  });
});

describe('copyElementHTMLToClipboard tests', () => {
  let originalClipboard: Clipboard | undefined;

  beforeEach(() => {
    originalClipboard = navigator.clipboard;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('should copy element innerHTML by default', async () => {
    const clipboardMock = mockClipboardWrite();

    const testElement = document.createElement('div');
    testElement.innerHTML = '<p>Test content</p>';

    await copyElementHTMLToClipboard(testElement);

    expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
    const clipboardItem = clipboardMock.mockWrite.mock.calls[0][0][0];
    expect(clipboardItem).toBeInstanceOf(ClipboardItem);
    expect(clipboardItem.types).toContain('text/html');
    expect(clipboardItem.types).toContain('text/plain');

    clipboardMock.restore();
  });

  test('should copy element outerHTML when inner is false', async () => {
    const clipboardMock = mockClipboardWrite();

    const testElement = document.createElement('div');
    testElement.className = 'test-class';
    testElement.innerHTML = '<p>Test content</p>';

    await copyElementHTMLToClipboard(testElement, { inner: false });

    expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
    const clipboardItem = clipboardMock.mockWrite.mock.calls[0][0][0];
    expect(clipboardItem).toBeInstanceOf(ClipboardItem);
    expect(clipboardItem.types).toContain('text/html');
    expect(clipboardItem.types).toContain('text/plain');

    clipboardMock.restore();
  });

  test('should handle clipboard write rejection gracefully', async () => {
    const clipboardMock = mockClipboardWriteRejection();

    const testElement = document.createElement('div');
    testElement.innerHTML = '<p>Test content</p>';

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await copyElementHTMLToClipboard(testElement);

    expect(clipboardMock.mockWrite).toHaveBeenCalledTimes(1);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    clipboardMock.restore();
  });

  test('should handle undefined clipboard API gracefully', async () => {
    const clipboardMock = mockClipboardUndefined();

    const testElement = document.createElement('div');
    testElement.innerHTML = '<p>Test content</p>';

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(copyElementHTMLToClipboard(testElement)).resolves.not.toThrow();

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    clipboardMock.restore();
  });
});
