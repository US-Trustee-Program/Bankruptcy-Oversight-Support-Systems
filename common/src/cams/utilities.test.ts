import {
  keyValuesToMap,
  keyValuesToRecord,
  symmetricDifference,
  levenshteinDistance,
  calculateStringSimilarity,
} from './utilities';

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

    test('should omit a pair without a key', () => {
      const encoded = '=value';
      const expected = {};
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

    test('should handle blank values', () => {
      const encoded = 'ONE=';
      const expected = {
        ONE: '',
      };
      const actual = keyValuesToRecord(encoded);
      expect(actual).toEqual(expected);
    });

    test('should handle values with equal signs', () => {
      const encoded = 'ONE=Config=Foo';
      const expected = {
        ONE: 'Config=Foo',
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

    test('should omit a pair without a key', () => {
      const encoded = '=value';
      const expected = new Map<string, string>();
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

    test('should handle blank values', () => {
      const encoded = 'ONE=';
      const expected = new Map<string, string>([['ONE', '']]);
      const actual = keyValuesToMap(encoded);
      expect(actual).toEqual(expected);
    });

    test('should handle values with equal signs', () => {
      const encoded = 'ONE=Config=Foo';
      const expected = new Map<string, string>([['ONE', 'Config=Foo']]);
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

describe('String similarity utilities', () => {
  describe('levenshteinDistance', () => {
    test('should return 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    test('should return string length when comparing with empty string', () => {
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', 'world')).toBe(5);
    });

    test('should calculate distance for single character differences', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1); // substitution
      expect(levenshteinDistance('cat', 'cats')).toBe(1); // insertion
      expect(levenshteinDistance('cats', 'cat')).toBe(1); // deletion
    });

    test('should calculate distance for multiple edits', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('book', 'back')).toBe(2);
      expect(levenshteinDistance('Saturday', 'Sunday')).toBe(3);
    });

    test('should be case-sensitive', () => {
      expect(levenshteinDistance('Hello', 'hello')).toBe(1);
      expect(levenshteinDistance('HELLO', 'hello')).toBe(5);
    });

    test('should handle names with different formats', () => {
      expect(levenshteinDistance('John Doe', 'Jon Doe')).toBe(1);
      expect(levenshteinDistance('John Doe', 'John A. Doe')).toBe(3);
    });
  });

  describe('calculateStringSimilarity', () => {
    test('should return 100 for identical strings', () => {
      expect(calculateStringSimilarity('hello', 'hello')).toBe(100);
      expect(calculateStringSimilarity('John Doe', 'John Doe')).toBe(100);
    });

    test('should return 100 for empty strings', () => {
      expect(calculateStringSimilarity('', '')).toBe(100);
    });

    test('should be case-insensitive by default', () => {
      expect(calculateStringSimilarity('Hello', 'hello')).toBe(100);
      expect(calculateStringSimilarity('JOHN DOE', 'john doe')).toBe(100);
    });

    test('should be case-sensitive when specified', () => {
      expect(calculateStringSimilarity('Hello', 'hello', true)).toBe(80);
      expect(calculateStringSimilarity('HELLO', 'hello', true)).toBe(0);
    });

    test('should calculate similarity percentage for similar strings', () => {
      const similarity = calculateStringSimilarity('John Doe', 'Jon Doe');
      expect(similarity).toBeCloseTo(87.5, 1); // 7/8 characters match
    });

    test('should calculate similarity for names with middle initials', () => {
      const similarity = calculateStringSimilarity('John Doe', 'John A. Doe');
      expect(similarity).toBeCloseTo(72.7, 1); // 8/11 characters match
    });

    test('should trim whitespace before comparison', () => {
      expect(calculateStringSimilarity('  hello  ', 'hello')).toBe(100);
      expect(calculateStringSimilarity('John Doe  ', '  John Doe')).toBe(100);
    });

    test('should return 0 for completely different strings', () => {
      expect(calculateStringSimilarity('abc', 'xyz')).toBe(0);
    });

    test('should handle real trustee name variations', () => {
      // Typo - very similar
      expect(calculateStringSimilarity('Aaron Amore', 'Aaron Amory')).toBeGreaterThan(85);

      // Nickname vs full name - 75% similar (3 char difference in 12 total)
      const nicknameSimilarity = calculateStringSimilarity('Andy Suhar', 'Andrew Suhar');
      expect(nicknameSimilarity).toBeGreaterThan(70);
      expect(nicknameSimilarity).toBeCloseTo(75, 0);

      // Middle initial missing - 80% similar
      expect(calculateStringSimilarity('Albert Togut', 'Albert J. Togut')).toBeGreaterThan(78);
    });
  });
});
