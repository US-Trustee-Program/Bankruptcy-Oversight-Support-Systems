import { vi } from 'vitest';
import DateHelper from './date-helper';

const { getTodaysIsoDate, isValidDateString, nowInSeconds, sortDates, sortDatesReverse } =
  DateHelper;

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
  ] as const;

  const validDateStrings = [['ISO date format', '2024-01-01', true]] as const;

  test.each([...invalidDateStrings, ...validDateStrings])(
    'should filter date strings - %s should return %s',
    (_description, input, expected) => {
      expect(isValidDateString(input)).toBe(expected);
    },
  );

  test("should get today's date", () => {
    // TODO: mock new Date()???
    const expected = new Date().toISOString().split('T')[0];
    const actual = getTodaysIsoDate();
    expect(actual).toEqual(expected);
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
});
