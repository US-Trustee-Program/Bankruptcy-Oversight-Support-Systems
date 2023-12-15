import { formatDate, formatDateTime } from './datetime';

describe('Date/Time utilities', () => {
  describe('formatDate', () => {
    test('should format a short ISO date string in MM/dd/YYYY format', async () => {
      const actual = formatDate('2023-12-01');
      expect(actual).toEqual('12/01/2023');
    });

    test('should format a long ISO date string in MM/dd/YYYY format', async () => {
      const dateString = new Date(2023, 1, 1).toISOString();
      const actual = formatDate(dateString);
      expect(actual).toEqual('02/01/2023');
    });

    test('should format an Date object in MM/dd/YYYY format', async () => {
      const actual = formatDate(new Date(2023, 1, 1));
      expect(actual).toEqual('02/01/2023');
    });

    test('should return the input if the date cannot be parsed', async () => {
      const actual = formatDate('unparsable');
      expect(actual).toEqual('unparsable');
    });
  });

  describe('formatDateTime', () => {
    test('should format a long ISO date string in MM/dd/YYYY HH:mm PM format with appropriate time zone', async () => {
      const timeZoneFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timeZoneName: 'short',
      });
      const myTimeZone = timeZoneFormatter.format(new Date()).split(' ')[1];

      const dateString = new Date(2023, 1, 1, 12, 1).toISOString();
      const actual = formatDateTime(dateString);
      expect(actual).toEqual(`02/01/2023 12:01 PM ${myTimeZone}`);
    });

    test('should return the input if the date cannot be parsed', async () => {
      const actual = formatDateTime('unparsable');
      expect(actual).toEqual('unparsable');
    });

    test('should format a Date in MM/dd/YYYY HH:mm PM format with appropriate time zone', async () => {
      const timeZoneFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timeZoneName: 'short',
      });
      const myTimeZone = timeZoneFormatter.format(new Date()).split(' ')[1];

      const date = new Date(2023, 1, 1, 12, 1);
      const actual = formatDateTime(date);
      expect(actual).toEqual(`02/01/2023 12:01 PM ${myTimeZone}`);
    });
  });
});
