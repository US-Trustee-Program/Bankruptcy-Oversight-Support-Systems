import { sanitizeExtensionInput } from './phone-extension.utils';

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
