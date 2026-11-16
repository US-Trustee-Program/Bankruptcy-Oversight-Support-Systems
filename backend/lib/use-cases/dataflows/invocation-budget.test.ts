import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest';
import { DEFAULT_INVOCATION_BUDGET_MS, shouldEscape } from './invocation-budget';

describe('invocation-budget', () => {
  const NOW = 1_000_000;

  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('DEFAULT_INVOCATION_BUDGET_MS is 56 minutes', () => {
    expect(DEFAULT_INVOCATION_BUDGET_MS).toBe(56 * 60 * 1000);
  });

  test('does not escape when elapsed plus next step cost stays under the threshold', () => {
    expect(shouldEscape(NOW - 1000, 60_000, 1000)).toBe(false);
  });

  test('does not escape one millisecond before the threshold', () => {
    expect(shouldEscape(NOW - 54_999, 60_000, 5000)).toBe(false);
  });

  test('escapes when elapsed plus next step cost exactly reaches the threshold', () => {
    expect(shouldEscape(NOW - 55_000, 60_000, 5000)).toBe(true);
  });

  test('escapes when elapsed plus next step cost exceeds the threshold', () => {
    expect(shouldEscape(NOW - 59_000, 60_000, 5000)).toBe(true);
  });
});
