import { formatDate } from './datetime';

describe('Date/Time utilities', () => {
  describe('formatDate', () => {
    it('should format a short ISO date string in MM/dd/YYYY format', async () => {
      const actual = formatDate('2023-12-01');
      expect(actual).toEqual('12/1/2023');
    });
    it('should format a long ISO date string in MM/dd/YYYY format', async () => {
      const dateString = new Date(2023, 11, 1).toISOString();
      const actual = formatDate(dateString);
      expect(actual).toEqual('12/1/2023');
    });
    it('should format an Date object in MM/dd/YYYY format', async () => {
      const actual = formatDate(new Date(2023, 11, 1));
      expect(actual).toEqual('12/1/2023');
    });
  });
});
