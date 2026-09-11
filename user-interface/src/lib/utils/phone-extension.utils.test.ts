import { formatPhoneWithExtension, sanitizeExtensionInput } from './phone-extension.utils';

describe('sanitizeExtensionInput', () => {
  test('strips non-digit characters', () => {
    expect(sanitizeExtensionInput('ab12cd')).toBe('12');
  });

  test('caps the result at 6 digits', () => {
    expect(sanitizeExtensionInput('1234567890')).toBe('123456');
  });

  test('caps at 6 digits even when non-digit noise pushes the raw length past 6', () => {
    // Simulates pasting something like "x-123456" — the digits themselves must
    // still be capped at 6 even though the raw pasted string is longer.
    expect(sanitizeExtensionInput('x-123456')).toBe('123456');
  });

  test('returns an empty string when there are no digits', () => {
    expect(sanitizeExtensionInput('abc')).toBe('');
  });

  test('returns an empty string for an empty input', () => {
    expect(sanitizeExtensionInput('')).toBe('');
  });
});

describe('formatPhoneWithExtension', () => {
  test('returns undefined when no phone is provided', () => {
    expect(formatPhoneWithExtension(undefined)).toBeUndefined();
  });

  test('returns just the number when there is no extension', () => {
    expect(formatPhoneWithExtension({ number: '212-555-0200' })).toBe('212-555-0200');
  });

  test('appends the extension in "x####" form when present', () => {
    expect(formatPhoneWithExtension({ number: '212-555-0200', extension: '1234' })).toBe(
      '212-555-0200 x1234',
    );
  });
});
