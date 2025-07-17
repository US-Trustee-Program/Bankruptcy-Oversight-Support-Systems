import {
  getTodaysIsoDate,
  isInvalidDate,
  isValidDateString,
  nowInSeconds,
  sortDates,
  sortDatesReverse,
} from './date-helper';

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

  test('should filter date strings', () => {
    expect(isValidDateString(undefined)).toBeFalsy();
    expect(isValidDateString(null)).toBeFalsy();
    expect(isValidDateString('')).toBeFalsy();
    expect(isValidDateString('bogus')).toBeFalsy();
    expect(isValidDateString('01/01/2024')).toBeFalsy();

    expect(isValidDateString('2024-01-01')).toBeTruthy();
  });

  test('should succeed for valid date', () => {
    const today = new Date();
    expect(isInvalidDate(today)).toEqual(false);
  });

  test('should fail for invalid date', () => {
    const today = new Date('nonsense');
    expect(isInvalidDate(today)).toEqual(true);
  });

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
    Date.now = jest.fn(() => mockTimestamp);

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
