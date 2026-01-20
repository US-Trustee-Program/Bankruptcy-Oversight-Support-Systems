import { copyStringToClipboard } from './clipBoard';

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
