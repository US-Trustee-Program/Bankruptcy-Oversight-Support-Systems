import { describe, expect, test } from 'vitest';
import { median } from './stats.js';

describe('median', () => {
  test('returns 0 for an empty array', () => {
    expect(median([])).toBe(0);
  });

  test('returns the middle value for an odd-count array', () => {
    expect(median([10, 20, 60])).toBe(20);
  });

  test('averages the two middle values for an even-count array', () => {
    expect(median([10, 20, 30, 40])).toBe(25);
  });

  test('sorts unordered input before computing the median', () => {
    expect(median([60, 10, 20])).toBe(20);
  });
});
