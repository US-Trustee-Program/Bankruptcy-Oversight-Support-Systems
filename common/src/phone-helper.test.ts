import { formatPhoneNumber, parsePhoneNumber } from './phone-helper';

describe('phone-helper', () => {
  describe('parsePhoneNumber', () => {
    test('should parse number with x extension', () => {
      expect(parsePhoneNumber('229.606.8381 x7478')).toEqual({
        number: '229-606-8381',
        extension: '7478',
      });
    });

    test('should parse number with ext extension', () => {
      expect(parsePhoneNumber('500-831-6978 ext 123')).toEqual({
        number: '500-831-6978',
        extension: '123',
      });
    });

    test('should parse number with ext. extension', () => {
      expect(parsePhoneNumber('500.831.6978 ext. 456')).toEqual({
        number: '500-831-6978',
        extension: '456',
      });
    });

    test('should parse number with extension keyword', () => {
      expect(parsePhoneNumber('229-606-8381 extension 9999')).toEqual({
        number: '229-606-8381',
        extension: '9999',
      });
    });

    test('should parse number without extension', () => {
      expect(parsePhoneNumber('5008316978')).toEqual({
        number: '500-831-6978',
        extension: undefined,
      });
    });

    test('should handle already formatted number without extension', () => {
      expect(parsePhoneNumber('500-831-6978')).toEqual({
        number: '500-831-6978',
        extension: undefined,
      });
    });

    test('should handle extension with non-digit characters', () => {
      expect(parsePhoneNumber('500-831-6978 x12-34')).toEqual({
        number: '500-831-6978',
        extension: '1234',
      });
    });

    test('should handle case-insensitive extension indicators', () => {
      expect(parsePhoneNumber('500-831-6978 X123')).toEqual({
        number: '500-831-6978',
        extension: '123',
      });
      expect(parsePhoneNumber('500-831-6978 EXT 123')).toEqual({
        number: '500-831-6978',
        extension: '123',
      });
    });

    test('should handle empty string', () => {
      expect(parsePhoneNumber('')).toEqual({
        number: '',
        extension: undefined,
      });
    });
  });

  describe('formatPhoneNumber', () => {
    test('should format 10-digit number without separators', () => {
      expect(formatPhoneNumber('5008316978')).toEqual('500-831-6978');
    });

    test('should format number with dots', () => {
      expect(formatPhoneNumber('500.831.6978')).toEqual('500-831-6978');
    });

    test('should format number with parentheses and spaces', () => {
      expect(formatPhoneNumber('(500) 831-6978')).toEqual('500-831-6978');
    });

    test('should format number with mixed separators', () => {
      expect(formatPhoneNumber('500-831.6978')).toEqual('500-831-6978');
    });

    test('should return original string if not 10 digits', () => {
      expect(formatPhoneNumber('123')).toEqual('123');
      expect(formatPhoneNumber('12345678901')).toEqual('12345678901');
      expect(formatPhoneNumber('1-800-CALL-NOW')).toEqual('1-800-CALL-NOW');
    });

    test('should handle empty string', () => {
      expect(formatPhoneNumber('')).toEqual('');
    });

    test('should handle already formatted number', () => {
      expect(formatPhoneNumber('500-831-6978')).toEqual('500-831-6978');
    });
  });
});
