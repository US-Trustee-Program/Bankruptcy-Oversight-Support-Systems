/// <reference types="node" />
import { vi, describe, test, expect, beforeAll, afterAll } from 'vitest';
import DateHelper from './date-helper';

const {
  addDays,
  formatDate,
  getCurrentIsoTimestamp,
  getIsoTimestamp,
  getTodaysIsoDate,
  isValidDateString,
  nowInSeconds,
  sortDates,
  sortDatesReverse,
  subtractDays,
} = DateHelper;

describe('date helper tests', () => {
  test('should sort dates newest first', () => {
    const middle = new Date(2024, 0, 1);
    const newest = new Date(2024, 1, 1);
    const oldest = new Date(2023, 11, 1);
    const dates = [middle, newest, newest, oldest];
    dates.sort(sortDatesReverse);
    expect(dates[0]).toEqual(newest);
    expect(dates[1]).toEqual(newest);
    expect(dates[2]).toEqual(middle);
    expect(dates[3]).toEqual(oldest);
  });

  test('should sort dates oldest first', () => {
    const middle = new Date(2024, 0, 1);
    const newest = new Date(2024, 1, 1);
    const oldest = new Date(2023, 11, 1);
    const dates = [middle, newest, newest, oldest];
    dates.sort(sortDates);
    expect(dates[0]).toEqual(oldest);
    expect(dates[1]).toEqual(middle);
    expect(dates[2]).toEqual(newest);
    expect(dates[3]).toEqual(newest);
  });

  const invalidDateStrings = [
    ['undefined', undefined, false],
    ['null', null, false],
    ['empty string', '', false],
    ['bogus string', 'bogus', false],
    ['US date format', '01/01/2024', false],
    // Calendar-invalid but YYYY-MM-DD-shaped -- Date.UTC silently normalizes out-of-range
    // components (rolls over into the next month) rather than rejecting them, so these must be
    // caught by round-tripping the parsed date back to a string, not by shape alone.
    ['nonexistent day (Feb 30)', '2025-02-30', false],
    ['nonexistent month (13)', '2025-13-01', false],
    ['day zero', '2025-01-00', false],
    ['nonexistent day in non-leap Feb 29', '2025-02-29', false],
  ] as const;

  const validDateStrings = [
    ['ISO date format', '2024-01-01', true],
    ['leap day in a leap year', '2024-02-29', true],
  ] as const;

  test.each([...invalidDateStrings, ...validDateStrings])(
    'should filter date strings - %s should return %s',
    (_description, input, expected) => {
      expect(isValidDateString(input)).toBe(expected);
    },
  );

  test("should get today's date", () => {
    const expected = new Date().toISOString().split('T')[0];
    const actual = getTodaysIsoDate();
    expect(actual).toEqual(expected);
  });

  test('should get ISO timestamp from a date', () => {
    const testDate = new Date('2024-03-15T14:30:45.123Z');
    const expected = '2024-03-15T14:30:45.123Z';
    const actual = getIsoTimestamp(testDate);
    expect(actual).toEqual(expected);
  });

  test('should get current ISO timestamp', () => {
    const beforeCall = new Date().toISOString();
    const actual = getCurrentIsoTimestamp();
    const afterCall = new Date().toISOString();

    expect(actual).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(actual >= beforeCall).toBe(true);
    expect(actual <= afterCall).toBe(true);
  });

  test('should convert current time to seconds', () => {
    // Mock Date.now() to return a fixed timestamp
    const mockTimestamp = 1609459200000; // 2021-01-01T00:00:00.000Z in milliseconds
    const originalDateNow = Date.now;
    Date.now = vi.fn(() => mockTimestamp);

    try {
      // Expected result is the timestamp in seconds (milliseconds / 1000, floored)
      const expected = Math.floor(mockTimestamp / 1000);
      const actual = nowInSeconds();

      expect(actual).toEqual(expected);
      expect(Date.now).toHaveBeenCalled();
    } finally {
      // Restore the original Date.now function
      Date.now = originalDateNow;
    }
  });

  describe('formatDate', () => {
    test('should format valid ISO date string to MM/DD/YYYY', () => {
      expect(formatDate('2024-01-15')).toBe('01/15/2024');
      expect(formatDate('1979-10-01')).toBe('10/01/1979');
      expect(formatDate('2025-12-31')).toBe('12/31/2025');
    });

    test('should return input as-is for invalid date strings', () => {
      expect(formatDate('')).toBe('');
      expect(formatDate('bogus')).toBe('bogus');
      expect(formatDate('01/15/2024')).toBe('01/15/2024');
      expect(formatDate('2024-1-1')).toBe('2024-1-1');
      expect(formatDate('not-a-date')).toBe('not-a-date');
    });
  });

  describe('addDays / subtractDays', () => {
    // CI (ubuntu-latest) runs with no TZ set, i.e. UTC — under UTC there's no DST offset, so
    // local-time methods (setDate/getDate) and UTC methods produce identical results and a
    // regression back to local-time mutation would pass every DST case below silently. Pin a
    // DST-observing zone so this suite actually exercises the local-vs-UTC divergence it guards
    // against. Node reads process.env.TZ lazily, so this works without a subprocess.
    const originalTZ = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = 'America/New_York';
    });
    afterAll(() => {
      process.env.TZ = originalTZ;
    });

    const cases = [
      ['a normal day', '2026-08-27', 1, '2026-08-28'],
      ['a month boundary', '2026-01-31', 1, '2026-02-01'],
      ['a year boundary', '2026-12-31', 1, '2027-01-01'],
      ['into a leap day', '2024-02-28', 1, '2024-02-29'],
      ['past a leap day', '2024-02-29', 1, '2024-03-01'],
      ['past a non-leap Feb', '2023-02-28', 1, '2023-03-01'],
      ['across the US DST-end transition', '2026-11-01', 1, '2026-11-02'],
      ['across the US DST-start transition', '2026-03-08', 1, '2026-03-09'],
    ] as const;

    test.each(cases)('addDays: %s', (_description, input, days, expected) => {
      expect(addDays(input, days)).toBe(expected);
    });

    test.each(cases)('subtractDays: %s (reversed)', (_description, expected, days, input) => {
      expect(subtractDays(input, days)).toBe(expected);
    });

    test('truncates a full ISO timestamp to its date portion before subtracting', () => {
      expect(subtractDays('2023-01-02T00:00:00.000Z', 1)).toBe('2023-01-01');
      expect(subtractDays('2024-01-01T00:00:00Z', 1)).toBe('2023-12-31');
    });

    test('returns input as-is for invalid date strings', () => {
      expect(addDays('bogus', 1)).toBe('bogus');
      expect(addDays('', 1)).toBe('');
      expect(subtractDays('not-a-date', 1)).toBe('not-a-date');
    });
  });
});
