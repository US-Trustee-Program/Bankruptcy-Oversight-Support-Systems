import { keyValuesToMap, keyValuesToRecord, symmetricDifference } from './utilities';

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

    test('should omit a pair without a key', () => {
      const encoded = '=value';
      const expected = {};
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

    test.each([
      ['omit a pair without a equal sign delimiter', 'foo|ONE=1|bad', { ONE: '1' }],
      ['omit empty pairs', '||ONE=1|||||', { ONE: '1' }],
      ['handle blank values', 'ONE=', { ONE: '' }],
      ['handle values with equal signs', 'ONE=Config=Foo', { ONE: 'Config=Foo' }],
    ])('should %s', (_desc, encoded, expected) => {
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

    test('should omit a pair without a key', () => {
      const encoded = '=value';
      const expected = new Map<string, string>();
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

    test.each([
      [
        'omit a pair without a equal sign delimiter',
        'foo|ONE=1|bad',
        new Map<string, string>([['ONE', '1']]),
      ],
      ['omit empty pairs', '||ONE=1|||||', new Map<string, string>([['ONE', '1']])],
      ['handle blank values', 'ONE=', new Map<string, string>([['ONE', '']])],
      [
        'handle values with equal signs',
        'ONE=Config=Foo',
        new Map<string, string>([['ONE', 'Config=Foo']]),
      ],
    ])('should %s', (_desc, encoded, expected) => {
      const actual = keyValuesToMap(encoded);
      expect(actual).toEqual(expected);
    });
  });

  describe('symmetricDifference', () => {
    test('should return items occurring in only one of two sets', () => {
      const setOne = new Set(['a', 'b', 'c']);
      const setTwo = new Set(['a', 'd', 'e']);
      const expected = new Set(['b', 'c', 'd', 'e']);
      expect(symmetricDifference(setOne, setTwo)).toEqual(expected);
    });
  });
});
