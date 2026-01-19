import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard, formatMeetingId } from './zoomInfo';

describe('zoomInfo', () => {
  describe('copyToClipboard', () => {
    let writeTextMock: ReturnType<typeof vi.fn>;
    let originalClipboard: Clipboard | undefined;

    beforeEach(() => {
      writeTextMock = vi.fn();
      originalClipboard = navigator.clipboard;
    });

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
      });
    });

    test('should copy text to clipboard successfully', async () => {
      writeTextMock.mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
      });

      copyToClipboard('test text');

      expect(writeTextMock).toHaveBeenCalledWith('test text');
    });

    test('should copy empty string to clipboard', async () => {
      writeTextMock.mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
      });

      copyToClipboard('');

      expect(writeTextMock).toHaveBeenCalledWith('');
    });

    test('should handle clipboard API rejection silently', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      writeTextMock.mockRejectedValue(new Error('Clipboard API failed'));
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: writeTextMock,
        },
        writable: true,
      });

      copyToClipboard('test text');

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(writeTextMock).toHaveBeenCalledWith('test text');
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    test('should handle undefined clipboard API silently', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      expect(() => copyToClipboard('test text')).not.toThrow();
    });
  });

  describe('formatMeetingId', () => {
    it('should format 10-digit meeting ID correctly', () => {
      const result = formatMeetingId('1234567890');
      expect(result).toBe('123 456 7890');
    });

    test('should return original meeting ID if less than 9 digits', () => {
      const result = formatMeetingId('12345678');
      expect(result).toBe('12345678');
    });

    test('should return original meeting ID if more than 11 digits', () => {
      const result = formatMeetingId('123456789012');
      expect(result).toBe('123456789012');
    });

    test('should return original meeting ID if empty string', () => {
      const result = formatMeetingId('');
      expect(result).toBe('');
    });

    test('should return original meeting ID if single digit', () => {
      const result = formatMeetingId('1');
      expect(result).toBe('1');
    });
  });
});
