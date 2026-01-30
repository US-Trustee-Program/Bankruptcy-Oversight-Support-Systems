import { describe, test, expect } from 'vitest';
import {
  generatePhoneticTokens,
  generateBigrams,
  isPhoneticToken,
  generateSearchTokens,
  generateQueryTokens,
  expandQueryWithNicknames,
  generatePhoneticTokensWithNicknames,
} from './phonetic-helper';

describe('Phonetic Utilities', () => {
  describe('generatePhoneticTokens', () => {
    test('should generate phonetic tokens for a single word', () => {
      const tokens = generatePhoneticTokens('Michael');
      expect(tokens).toContain('M240');
      expect(tokens).toContain('MKSHL');
    });

    test('should generate phonetic tokens for multiple words', () => {
      const tokens = generatePhoneticTokens('John Smith');
      expect(tokens).toContain('J500');
      expect(tokens).toContain('JN');
      expect(tokens).toContain('S530');
      expect(tokens).toContain('SM0');
    });

    test('should handle empty input', () => {
      const tokens = generatePhoneticTokens('');
      expect(tokens).toEqual([]);
    });

    test('should handle undefined input', () => {
      const tokens = generatePhoneticTokens(undefined);
      expect(tokens).toEqual([]);
    });

    test('should handle names with special characters', () => {
      const tokens = generatePhoneticTokens("O'Brien");
      expect(tokens).toContain('O165');
      expect(tokens).toContain('OBRN');
    });

    test('should normalize case and trim whitespace', () => {
      const tokens1 = generatePhoneticTokens('MICHAEL');
      const tokens2 = generatePhoneticTokens('michael');
      const tokens3 = generatePhoneticTokens('  Michael  ');

      expect(tokens1).toEqual(tokens2);
      expect(tokens2).toEqual(tokens3);
    });
  });

  describe('generateBigrams', () => {
    test('should generate bigrams for a single word', () => {
      const bigrams = generateBigrams('John');
      expect(bigrams).toContain('jo');
      expect(bigrams).toContain('oh');
      expect(bigrams).toContain('hn');
      expect(bigrams).toHaveLength(3);
    });

    test('should generate bigrams for multiple words', () => {
      const bigrams = generateBigrams('John Smith');
      expect(bigrams).toContain('jo');
      expect(bigrams).toContain('oh');
      expect(bigrams).toContain('hn');
      expect(bigrams).toContain('sm');
      expect(bigrams).toContain('mi');
      expect(bigrams).toContain('it');
      expect(bigrams).toContain('th');
    });

    test('should return lowercase bigrams', () => {
      const bigrams = generateBigrams('JOHN');
      bigrams.forEach((bigram) => {
        expect(bigram).toBe(bigram.toLowerCase());
      });
    });

    test('should handle empty input', () => {
      expect(generateBigrams('')).toEqual([]);
      expect(generateBigrams(undefined)).toEqual([]);
      expect(generateBigrams('   ')).toEqual([]);
    });

    test('should skip single-character words', () => {
      const bigrams = generateBigrams('A B John');
      expect(bigrams).not.toContain('a');
      expect(bigrams).not.toContain('b');
      expect(bigrams).toContain('jo');
    });

    test('should handle special characters by removing them', () => {
      const bigrams = generateBigrams("O'Brien");
      expect(bigrams).toContain('ob');
      expect(bigrams).toContain('br');
      expect(bigrams).toContain('ri');
      expect(bigrams).toContain('ie');
      expect(bigrams).toContain('en');
    });

    test('should deduplicate bigrams', () => {
      const bigrams = generateBigrams('Anna Banana');
      const uniqueBigrams = [...new Set(bigrams)];
      expect(bigrams.length).toBe(uniqueBigrams.length);
    });

    test('should handle short names (2 characters)', () => {
      const bigrams = generateBigrams('Wu');
      expect(bigrams).toContain('wu');
      expect(bigrams).toHaveLength(1);
    });
  });

  describe('isPhoneticToken', () => {
    test('should return true for Soundex codes', () => {
      expect(isPhoneticToken('J500')).toBe(true);
      expect(isPhoneticToken('S530')).toBe(true);
      expect(isPhoneticToken('M240')).toBe(true);
    });

    test('should return true for Metaphone codes', () => {
      expect(isPhoneticToken('JN')).toBe(true);
      expect(isPhoneticToken('SM0')).toBe(true);
      expect(isPhoneticToken('MKSHL')).toBe(true);
    });

    test('should return false for lowercase bigrams', () => {
      expect(isPhoneticToken('jo')).toBe(false);
      expect(isPhoneticToken('sm')).toBe(false);
      expect(isPhoneticToken('th')).toBe(false);
    });

    test('should return false for single character tokens', () => {
      expect(isPhoneticToken('J')).toBe(false);
      expect(isPhoneticToken('A')).toBe(false);
    });

    test('should return false for mixed case tokens', () => {
      expect(isPhoneticToken('Jo')).toBe(false);
      expect(isPhoneticToken('jN')).toBe(false);
    });

    test('should return false for empty string', () => {
      expect(isPhoneticToken('')).toBe(false);
    });
  });

  describe('generateSearchTokens', () => {
    test('should combine bigrams and phonetic tokens', () => {
      const tokens = generateSearchTokens('John');
      const bigrams = tokens.filter((t) => !isPhoneticToken(t));
      const phonetics = tokens.filter((t) => isPhoneticToken(t));

      expect(bigrams).toContain('jo');
      expect(bigrams).toContain('oh');
      expect(bigrams).toContain('hn');
      expect(phonetics).toContain('J500');
      expect(phonetics).toContain('JN');
    });

    test('should generate tokens for multiple words', () => {
      const tokens = generateSearchTokens('John Smith');

      expect(tokens).toContain('jo');
      expect(tokens).toContain('sm');
      expect(tokens).toContain('J500');
      expect(tokens).toContain('S530');
    });

    test('should handle empty input', () => {
      expect(generateSearchTokens('')).toEqual([]);
      expect(generateSearchTokens(undefined)).toEqual([]);
    });

    test('should return unique tokens', () => {
      const tokens = generateSearchTokens('Anna Banana');
      const uniqueTokens = [...new Set(tokens)];
      expect(tokens.length).toBe(uniqueTokens.length);
    });

    test('should generate both Soundex and Metaphone phonetic tokens', () => {
      const tokens = generateSearchTokens('Michael');
      expect(tokens).toContain('M240');
      expect(tokens).toContain('MKSHL');
    });
  });

  describe('generateQueryTokens', () => {
    test('should expand nicknames and generate tokens', () => {
      const tokens = generateQueryTokens('Mike');

      expect(tokens).toContain('mi');
      expect(tokens).toContain('M200');

      const hasMichaelTokens = tokens.some((t) => t === 'MKSHL' || t === 'M240');
      expect(hasMichaelTokens).toBe(true);
    });

    test('should handle multiple words with nickname expansion', () => {
      const tokens = generateQueryTokens('Mike Smith');

      expect(tokens).toContain('mi');
      expect(tokens).toContain('sm');
      expect(tokens).toContain('S530');
    });

    test('should handle empty input', () => {
      expect(generateQueryTokens('')).toEqual([]);
      expect(generateQueryTokens(undefined)).toEqual([]);
    });

    test('should include tokens for all nickname variations', () => {
      const tokens = generateQueryTokens('Bob');

      const hasRobertTokens = tokens.some((t) => t === 'RBRT' || t === 'R163');
      expect(hasRobertTokens).toBe(true);
    });
  });

  describe('expandQueryWithNicknames', () => {
    test('should expand common nicknames', () => {
      const expanded = expandQueryWithNicknames('Mike');
      expect(expanded).toContain('mike');
      expect(expanded).toContain('michael');
    });

    test('should include the original name', () => {
      const expanded = expandQueryWithNicknames('Michael');
      expect(expanded).toContain('michael');
      expect(expanded).toContain('mike');
    });

    test('should handle empty input', () => {
      const expanded = expandQueryWithNicknames('');
      expect(expanded).toEqual([]);
    });

    test('should handle multiple words', () => {
      const expanded = expandQueryWithNicknames('Mike Johnson');
      expect(expanded).toContain('mike');
      expect(expanded).toContain('michael');
      expect(expanded).toContain('johnson');
    });
  });

  describe('generatePhoneticTokensWithNicknames', () => {
    test('should combine nickname expansion with phonetic tokens', () => {
      const tokens = generatePhoneticTokensWithNicknames('Mike');
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toContain('M200');
      expect(tokens).toContain('M240');
    });

    test('should handle empty input', () => {
      const tokens = generatePhoneticTokensWithNicknames('');
      expect(tokens).toEqual([]);
    });
  });
});
