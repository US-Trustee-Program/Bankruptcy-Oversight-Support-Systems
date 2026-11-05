import { describe, test, expect } from 'vitest';
import { DEFAULT_INVOCATION_BUDGET_MS, shouldEscape } from './invocation-budget';

describe('invocation-budget', () => {
  test('DEFAULT_INVOCATION_BUDGET_MS is 56 minutes', () => {
    expect(DEFAULT_INVOCATION_BUDGET_MS).toBe(56 * 60 * 1000);
  });

  test('does not escape when elapsed plus next step cost stays under the threshold', () => {
    const startedAt = Date.now() - 1000;
    expect(shouldEscape(startedAt, 60_000, 1000)).toBe(false);
  });

  test('escapes when elapsed plus next step cost reaches the threshold', () => {
    const startedAt = Date.now() - 55_000;
    expect(shouldEscape(startedAt, 60_000, 5000)).toBe(true);
  });

  test('escapes when elapsed plus next step cost exceeds the threshold', () => {
    const startedAt = Date.now() - 59_000;
    expect(shouldEscape(startedAt, 60_000, 5000)).toBe(true);
  });
});
