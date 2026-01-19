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

    it('should copy text to clipboard successfully', async () => {
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

    it('should copy empty string to clipboard', async () => {
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

    it('should handle clipboard API rejection silently', async () => {
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

    it('should handle undefined clipboard API silently', () => {
      Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        writable: true,
      });

      expect(() => copyToClipboard('test text')).not.toThrow();
    });
  });

  describe('formatMeetingId', () => {
    it('should format 9-digit meeting ID correctly', () => {
      const result = formatMeetingId('123456789');
      expect(result).toBe('123 456 789');
    });

    it('should format 10-digit meeting ID correctly', () => {
      const result = formatMeetingId('1234567890');
      expect(result).toBe('123 456 7890');
    });

    it('should format 11-digit meeting ID correctly', () => {
      const result = formatMeetingId('12345678901');
      expect(result).toBe('123 456 78901');
    });

    it('should return original meeting ID if less than 9 digits', () => {
      const result = formatMeetingId('12345678');
      expect(result).toBe('12345678');
    });

    it('should return original meeting ID if more than 11 digits', () => {
      const result = formatMeetingId('123456789012');
      expect(result).toBe('123456789012');
    });

    it('should return original meeting ID if empty string', () => {
      const result = formatMeetingId('');
      expect(result).toBe('');
    });

    it('should return original meeting ID if single digit', () => {
      const result = formatMeetingId('1');
      expect(result).toBe('1');
    });

    it('should handle meeting ID with exactly boundary length', () => {
      const result8 = formatMeetingId('12345678');
      expect(result8).toBe('12345678');

      const result9 = formatMeetingId('123456789');
      expect(result9).toBe('123 456 789');

      const result11 = formatMeetingId('12345678901');
      expect(result11).toBe('123 456 78901');

      const result12 = formatMeetingId('123456789012');
      expect(result12).toBe('123456789012');
    });
  });
});
