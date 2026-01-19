import { describe, it, expect } from 'vitest';
import { formatMeetingId } from './zoomInfo';

describe('zoomInfo', () => {
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
