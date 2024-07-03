import { keyValuesToMap, keyValuesToRecord } from './utilities';

describe('Key Value utils', () => {
  describe('keyValuesToRecord', () => {
    test('should turn a key value string into a record', () => {
      const encoded = 'ONE=1|TWO=2';
      const expected = {
        ONE: '1',
        TWO: '2',
      };
      const actual = keyValuesToRecord(encoded);
      expect(actual).toEqual(expected);
    });

    test('should turn a blank string into an empty record', () => {
      const encoded = '';
      const expected = {};
      const actual = keyValuesToRecord(encoded);
      expect(actual).toEqual(expected);
    });

    test('should omit a pair without a equal sign delimiter', () => {
      const encoded = 'foo|ONE=1|bad';
      const expected = {
        ONE: '1',
      };
      const actual = keyValuesToRecord(encoded);
      expect(actual).toEqual(expected);
    });

    test('should omit empty pairs', () => {
      const encoded = '||ONE=1|||||';
      const expected = {
        ONE: '1',
      };
      const actual = keyValuesToRecord(encoded);
      expect(actual).toEqual(expected);
    });

    test('should trim keys and values', () => {
      const encoded = ' ONE = 1 | TWO      = 2         ';
      const expected = {
        ONE: '1',
        TWO: '2',
      };
      const actual = keyValuesToRecord(encoded);
      expect(actual).toEqual(expected);
    });
  });

  describe('keyValuesToMap', () => {
    test('should turn a key value string into a record', () => {
      const encoded = 'ONE=1|TWO=2';
      const expected = new Map<string, string>([
        ['ONE', '1'],
        ['TWO', '2'],
      ]);
      const actual = keyValuesToMap(encoded);
      expect(actual).toEqual(expected);
    });

    test('should turn a blank string into an empty record', () => {
      const encoded = '';
      const expected = new Map<string, string>();
      const actual = keyValuesToMap(encoded);
      expect(actual).toEqual(expected);
    });

    test('should omit a pair without a equal sign delimiter', () => {
      const encoded = 'foo|ONE=1|bad';
      const expected = new Map<string, string>([['ONE', '1']]);
      const actual = keyValuesToMap(encoded);
      expect(actual).toEqual(expected);
    });

    test('should omit empty pairs', () => {
      const encoded = '||ONE=1|||||';
      const expected = new Map<string, string>([['ONE', '1']]);
      const actual = keyValuesToMap(encoded);
      expect(actual).toEqual(expected);
    });

    test('should trim keys and values', () => {
      const encoded = ' ONE = 1 | TWO      = 2         ';
      const expected = new Map<string, string>([
        ['ONE', '1'],
        ['TWO', '2'],
      ]);
      const actual = keyValuesToMap(encoded);
      expect(actual).toEqual(expected);
    });
  });
});
