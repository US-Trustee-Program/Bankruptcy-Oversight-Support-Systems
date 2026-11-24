import { includesIgnoringCase, parseYesNo } from './string-helper';

describe('parseYesNo', () => {
  test('should normalize y/n values case-insensitively', () => {
    expect(parseYesNo('Y')).toBe('y');
    expect(parseYesNo('N')).toBe('n');
    expect(parseYesNo('  y  ')).toBe('y');
  });

  test('should return undefined for undefined input', () => {
    expect(parseYesNo(undefined)).toBeUndefined();
  });

  test('should return undefined for a non-y/n value', () => {
    expect(parseYesNo('x')).toBeUndefined();
  });
});

describe('includesIgnoringCase', () => {
  test.each([
    { value: 'Bob Baker', search: 'BAKER', expected: true },
    { value: 'Bob Baker', search: 'carter', expected: false },
    { value: 'Bob Baker', search: undefined, expected: true },
    { value: 'Bob Baker', search: '', expected: true },
    { value: undefined, search: 'bob', expected: false },
    { value: undefined, search: undefined, expected: true },
  ])('should return $expected for "$value" containing "$search"', ({ value, search, expected }) => {
    expect(includesIgnoringCase(value, search)).toBe(expected);
  });
});
