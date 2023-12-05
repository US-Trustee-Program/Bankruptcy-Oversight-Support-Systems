import { CamsError } from '../../common-errors/cams-error';
import {
  getDate,
  calculateDifferenceInMonths,
  getYearMonthDayStringFromDate,
  getMonthDayYearStringFromDate,
  sortDates,
} from './date-helper';

describe('date-helper tests', () => {
  describe('getDate tests', () => {
    test('should return Jan 1, 2023', async () => {
      const actual = getDate(2023, 1, 1);
      expect(actual.toDateString()).toEqual('Sun Jan 01 2023');
    });

    test('should throw error for month of 13', async () => {
      let actual: Error;
      try {
        getDate(2023, 13, 1);
      } catch (e) {
        actual = e;
      }
      expect(actual.message).toEqual(
        'month cannot be greater than 12 and dayOfMonth cannot be greater than 31',
      );
      expect(actual instanceof CamsError).toBe(true);
    });

    test('should throw error for dayOfMonth of 32', async () => {
      let actual: Error;
      try {
        getDate(2023, 1, 32);
      } catch (e) {
        actual = e;
      }
      expect(actual.message).toEqual(
        'month cannot be greater than 12 and dayOfMonth cannot be greater than 31',
      );
      expect(actual instanceof CamsError).toBe(true);
    });

    test('should throw error for month of 0', async () => {
      let actual: Error;
      try {
        getDate(2023, 0, 1);
      } catch (e) {
        actual = e;
      }
      expect(actual.message).toEqual(
        'month and dayOfMonth should be real month and day numbers, not zero-based',
      );
    });

    test('should throw error for dayOfMonth of 0', async () => {
      let actual: Error;
      try {
        getDate(2023, 1, 0);
      } catch (e) {
        actual = e;
      }
      expect(actual.message).toEqual(
        'month and dayOfMonth should be real month and day numbers, not zero-based',
      );
    });
  });

  describe('calculateDifferenceInMonths tests', () => {
    test('should return 1 (a)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2023, 8, 18),
        getDate(2023, 6, 19),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (b)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2023, 6, 19),
        getDate(2023, 8, 18),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (c)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2022, 11, 18),
        getDate(2023, 1, 17),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 1 (d)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2022, 12, 17),
        getDate(2023, 1, 18),
      );

      expect(monthsDifference).toEqual(1);
    });

    test('should return 2 (a)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2023, 8, 19),
        getDate(2023, 6, 18),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (b)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2023, 6, 18),
        getDate(2023, 8, 19),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (c)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2022, 11, 18),
        getDate(2023, 2, 17),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 2 (d)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2022, 12, 17),
        getDate(2023, 2, 18),
      );

      expect(monthsDifference).toEqual(2);
    });

    test('should return 12', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2021, 12, 16),
        getDate(2023, 1, 1),
      );

      expect(monthsDifference).toEqual(12);
    });

    test('should return 13', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2021, 12, 16),
        getDate(2023, 2, 1),
      );

      expect(monthsDifference).toEqual(13);
    });

    test('should return 24', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2020, 1, 1),
        getDate(2022, 1, 1),
      );

      expect(monthsDifference).toEqual(24);
    });

    test('should return 60 (few days after 60 months)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2023, 7, 19),
        getDate(2018, 7, 14),
      );

      expect(monthsDifference).toEqual(60);
    });

    test('should return 60 (few before 61 months)', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2023, 7, 18),
        getDate(2018, 6, 30),
      );

      expect(monthsDifference).toEqual(60);
    });

    test('should return 0', async () => {
      const monthsDifference = calculateDifferenceInMonths(
        getDate(2023, 7, 18),
        getDate(2023, 7, 30),
      );

      expect(monthsDifference).toEqual(0);
    });
  });

  describe('getYearMonthDayStringFromDate tests', () => {
    test('should properly handle dates between Jan 1, 1000 and Dec 31, 9999', async () => {
      expect(getYearMonthDayStringFromDate(new Date(2023, 6, 19))).toEqual('2023-07-19');
    });

    test('should properly handle dates prior to Jan 1, 1000', async () => {
      expect(getYearMonthDayStringFromDate(new Date(680, 0, 1))).toEqual('0680-01-01');
    });

    test('should properly handle date later than Dec 31, 9999', async () => {
      expect(getYearMonthDayStringFromDate(new Date(10000, 0, 1))).toEqual('+010000-01-01');
    });
  });

  describe('getMonthDayYearStringFromDate tests', () => {
    test('should convert Jan 1, 2023 to 2023-01-01', async () => {
      expect(getMonthDayYearStringFromDate(new Date(2023, 0, 1))).toEqual('2023-01-01');
    });
  });

  describe('sortDates tests', () => {
    test('should properly sort dates in chronological order', async () => {
      const date1 = getDate(2000, 3, 27);
      const date2 = getDate(1995, 3, 30);
      const date3 = getDate(2040, 1, 14);
      const dates = [date1, date2, date3];
      const sorted = [date2, date1, date3];

      sortDates(dates, 'chronological');
      expect(dates).toEqual(sorted);
    });

    test('should properly sort dates in reverse chronological order', async () => {
      const date1 = getDate(2000, 3, 27);
      const date2 = getDate(1995, 3, 30);
      const date3 = getDate(2040, 1, 14);
      const datesWithParameter = [date1, date2, date3];
      const datesWithDefault = [date1, date2, date3];
      const sorted = [date3, date1, date2];

      sortDates(datesWithParameter, 'reverse');
      expect(datesWithParameter).toEqual(sorted);

      sortDates(datesWithDefault);
      expect(datesWithDefault).toEqual(sorted);
    });
  });
});
