import { parseYesNo } from './string-helper';

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
