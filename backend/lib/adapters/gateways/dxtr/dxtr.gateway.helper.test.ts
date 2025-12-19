import { parseDebtorType, parsePetitionType, parseTransactionDate } from './dxtr.gateway.helper';
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
        expect.objectContaining({
          message: 'The transaction contains non-numeric characters in the date string.',
          status: 500,
          module: 'DXTR-GATEWAY-HELPER',
        }),
      );
    });
  });

  describe('parseDebtorType tests', () => {
    const type1TransactionRecToTest = [
      [
        '1081201013220-10132            15CB               000000000000000000200117999992001179999920011799999200117VP000000                                 NNNNN',
        'CB',
      ],
      [
        '1081201013220-10132            15IB               000000000000000000200117999992001179999920011799999200117VP000000                                 NNNNN',
        'IB',
      ],
      [
        '1081201013220-10132            15IC               000000000000000000200117999992001179999920011799999200117VP000000                                 NNNNN',
        'IC',
      ],
    ];

    test.each(type1TransactionRecToTest)(
      'should return the expected debtor type name',
      (txRecord: string, expected: string) => {
        const transactionRecord: DxtrTransactionRecord = {
          txCode: '1',
          txRecord,
        };

        expect(parseDebtorType(transactionRecord)).toEqual(expected);
      },
    );
  });

  describe('parsePetitionType tests', () => {
    const petitionsToTest = [
      [
        '0000000000000-00000            00AA               000000000000000000000000000000000000000000000000000000000IP000000                                 NNNNN',
        'IP',
      ],
      [
        '0000000000000-00000            00AA               000000000000000000000000000000000000000000000000000000000TI000000                                 NNNNN',
        'TI',
      ],
      [
        '0000000000000-00000            00AA               000000000000000000000000000000000000000000000000000000000TV000000                                 NNNNN',
        'TV',
      ],
      [
        '0000000000000-00000            00AA               000000000000000000000000000000000000000000000000000000000VP000000                                 NNNNN',
        'VP',
      ],
    ];

    test.each(petitionsToTest)(
      'should return the expected petition label',
      (txRecord: string, expected: string) => {
        const transactionRecord: DxtrTransactionRecord = {
          txCode: '1',
          txRecord,
        };

        expect(parsePetitionType(transactionRecord)).toEqual(expected);
      },
    );
  });
});
