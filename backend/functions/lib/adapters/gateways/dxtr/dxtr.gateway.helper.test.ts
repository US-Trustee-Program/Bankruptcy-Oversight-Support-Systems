import { parseTransactionDate } from './dxtr.gateway.helper';
import { CamsError } from '../../../common-errors/cams-error';

describe('DXTR Gateway Helper Tests', () => {
  describe('parseTransactionDate tests', () => {
    test('should return January 1st 2023', async () => {
      const record = { txRecord: 'zzzzzzzzzzzzzzzzzzz230101zzzzzzzzzzzz', txCode: 'OCO' };
      const actual = parseTransactionDate(record).valueOf();
      const expected = Date.parse('2023-01-01T00:00:00');
      expect(actual).toEqual(expected);
    });

    test('should return December 31st 2055', () => {
      const record = { txRecord: 'zzzzzzzzzzzzzzzzzzz551231zzzzzzzzzzzz', txCode: 'OCO' };
      const actual = parseTransactionDate(record).valueOf();
      const expected = Date.parse('2055-12-31T00:00:00');
      expect(actual).toEqual(expected);
    });

    test('should throw if date string contains any non-numeric characters', async () => {
      // The following expect highlights why each character in the string must be individually parsed.
      expect(parseInt('5f')).toEqual(5);
      const record = { txRecord: 'zzzzzzzzzzzzzzzzzzzAF1231zzzzzzzzzzzz', txCode: 'OCO' };
      expect(() => {
        parseTransactionDate(record);
      }).toThrow(
        new CamsError('', {
          message: 'The transaction contains non-numeric characters in the date string.',
        }),
      );
    });
  });
});
