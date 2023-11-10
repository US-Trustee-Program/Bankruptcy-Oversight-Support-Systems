import { parseDebtorType, parseTransactionDate } from './dxtr.gateway.helper';
import { CamsError } from '../../../common-errors/cams-error';
import { DxtrTransactionRecord } from '../../types/cases';

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
  describe('parseDebtorType tests', () => {
    // 1081201013220-10132            15CB               000000000000000000200117999992001179999920011799999200117VP000000                                 NNNNN
    // 1081231056523-10565            15IB00-0000000
    test('should return string Corporate Business', () => {
      const transactionRecord: DxtrTransactionRecord = {
        txCode: '---',
        txRecord:
          '1081201013220-10132            15CB               000000000000000000200117999992001179999920011799999200117VP000000                                 NNNNN',
      };

      expect(parseDebtorType(transactionRecord)).toEqual('Corporate Business');
    });
  });
});
