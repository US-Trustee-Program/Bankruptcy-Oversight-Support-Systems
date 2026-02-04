import { describe, test, expect } from 'vitest';
import {
  generatePhoneticTokens,
  generateBigrams,
  generateSearchTokens,
  generateQueryTokensWithNicknames,
  generateStructuredQueryTokens,
} from './phonetic-helper';
import MongoAggregateRenderer from '../gateways/mongo/utils/mongo-aggregate-renderer';

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

  describe('generateSearchTokens', () => {
    test('should combine bigrams and phonetic tokens', () => {
      const tokens = generateSearchTokens('John');
      const bigrams = tokens.filter((t) => !MongoAggregateRenderer.isPhoneticToken(t));
      const phonetics = tokens.filter((t) => MongoAggregateRenderer.isPhoneticToken(t));

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

  describe('generateQueryTokensWithNicknames', () => {
    test('should return empty arrays for empty input', () => {
      const result = generateQueryTokensWithNicknames('');
      expect(result.searchTokens).toEqual([]);
      expect(result.nicknameTokens).toEqual([]);
    });

    test('should return empty arrays for whitespace-only input', () => {
      const result = generateQueryTokensWithNicknames('   ');
      expect(result.searchTokens).toEqual([]);
      expect(result.nicknameTokens).toEqual([]);
    });

    test('should generate searchTokens for the original query', () => {
      const result = generateQueryTokensWithNicknames('John');

      expect(result.searchTokens).toContain('jo');
      expect(result.searchTokens).toContain('oh');
      expect(result.searchTokens).toContain('hn');
      expect(result.searchTokens).toContain('J500');
      expect(result.searchTokens).toContain('JN');
    });

    test('should expand nicknames and generate nicknameTokens', () => {
      const result = generateQueryTokensWithNicknames('Mike');

      expect(result.searchTokens).toContain('mi');
      expect(result.searchTokens).toContain('ik');
      expect(result.searchTokens).toContain('ke');
      expect(result.searchTokens).toContain('M200');

      expect(result.nicknameTokens.length).toBeGreaterThan(0);
      const hasMichaelTokens =
        result.nicknameTokens.includes('M240') || result.nicknameTokens.includes('MKSHL');
      expect(hasMichaelTokens).toBe(true);
    });

    test('should handle multiple words with nickname expansion', () => {
      const result = generateQueryTokensWithNicknames('Mike Smith');

      expect(result.searchTokens).toContain('mi');
      expect(result.searchTokens).toContain('sm');
      expect(result.searchTokens).toContain('S530');

      const hasMichaelTokens =
        result.nicknameTokens.includes('M240') || result.nicknameTokens.includes('MKSHL');
      expect(hasMichaelTokens).toBe(true);
    });

    test('should not include overlapping tokens in nicknameTokens', () => {
      const result = generateQueryTokensWithNicknames('Mike');

      const overlap = result.nicknameTokens.filter((t) => result.searchTokens.includes(t));
      expect(overlap).toHaveLength(0);
    });

    test('should handle names without known nicknames', () => {
      const result = generateQueryTokensWithNicknames('Zyzzyva');

      expect(result.searchTokens.length).toBeGreaterThan(0);
      expect(result.nicknameTokens).toEqual([]);
    });

    test('should expand Bob to Robert', () => {
      const result = generateQueryTokensWithNicknames('Bob');

      const hasRobertPhonetics =
        result.nicknameTokens.includes('RBRT') || result.nicknameTokens.includes('R163');
      expect(hasRobertPhonetics).toBe(true);
    });

    test('should expand Bill to William', () => {
      const result = generateQueryTokensWithNicknames('Bill');

      const hasWilliamBigrams =
        result.nicknameTokens.includes('wi') || result.nicknameTokens.includes('il');
      expect(hasWilliamBigrams).toBe(true);
    });

    test('should handle case insensitivity', () => {
      const lowerResult = generateQueryTokensWithNicknames('mike');
      const upperResult = generateQueryTokensWithNicknames('MIKE');
      const mixedResult = generateQueryTokensWithNicknames('MiKe');

      expect(lowerResult.searchTokens.sort()).toEqual(upperResult.searchTokens.sort());
      expect(upperResult.searchTokens.sort()).toEqual(mixedResult.searchTokens.sort());
    });

    test('should deduplicate tokens', () => {
      const result = generateQueryTokensWithNicknames('Anna');

      const uniqueSearchTokens = [...new Set(result.searchTokens)];
      const uniqueNicknameTokens = [...new Set(result.nicknameTokens)];

      expect(result.searchTokens.length).toBe(uniqueSearchTokens.length);
      expect(result.nicknameTokens.length).toBe(uniqueNicknameTokens.length);
    });
  });

  describe('generateStructuredQueryTokens', () => {
    test('should return empty arrays for empty input', () => {
      const result = generateStructuredQueryTokens('');
      expect(result.searchWords).toEqual([]);
      expect(result.nicknameWords).toEqual([]);
      expect(result.searchMetaphones).toEqual([]);
      expect(result.nicknameMetaphones).toEqual([]);
      expect(result.searchTokens).toEqual([]);
      expect(result.nicknameTokens).toEqual([]);
    });

    test('should return searchWords as normalized lowercase words', () => {
      const result = generateStructuredQueryTokens('John Smith');
      expect(result.searchWords).toEqual(['john', 'smith']);
    });

    test('should return nicknameWords for names with known nicknames', () => {
      const result = generateStructuredQueryTokens('Mike');
      expect(result.nicknameWords).toContain('michael');
    });

    test('should return searchMetaphones (Metaphone only, not Soundex)', () => {
      const result = generateStructuredQueryTokens('John');
      // JN is Metaphone, J500 is Soundex
      expect(result.searchMetaphones).toContain('JN');
      expect(result.searchMetaphones).not.toContain('J500');
    });

    test('should return nicknameMetaphones for nickname words', () => {
      const result = generateStructuredQueryTokens('Mike');
      // MKSHL is Metaphone for Michael
      expect(result.nicknameMetaphones).toContain('MKSHL');
    });

    test('should not include overlapping metaphones in nicknameMetaphones', () => {
      const result = generateStructuredQueryTokens('Mike');
      // MK is shared between Mike and Michael, should only be in searchMetaphones
      const overlap = result.nicknameMetaphones.filter((m) => result.searchMetaphones.includes(m));
      expect(overlap).toHaveLength(0);
    });

    test('should maintain backward compatibility with searchTokens and nicknameTokens', () => {
      const result = generateStructuredQueryTokens('Mike');

      // searchTokens should contain both bigrams and phonetics
      expect(result.searchTokens).toContain('mi');
      expect(result.searchTokens).toContain('ik');
      expect(result.searchTokens).toContain('ke');
      expect(result.searchTokens).toContain('MK');
      expect(result.searchTokens).toContain('M200');

      // nicknameTokens should contain tokens from nicknames, excluding overlap
      expect(result.nicknameTokens.length).toBeGreaterThan(0);
    });

    test('should handle multiple words with mixed nickname expansion', () => {
      const result = generateStructuredQueryTokens('Mike Smith');

      expect(result.searchWords).toEqual(['mike', 'smith']);
      expect(result.nicknameWords).toContain('michael');
      expect(result.searchMetaphones).toContain('MK');
      expect(result.searchMetaphones).toContain('SM0');
    });

    test('should handle case insensitivity', () => {
      const lowerResult = generateStructuredQueryTokens('mike');
      const upperResult = generateStructuredQueryTokens('MIKE');

      expect(lowerResult.searchWords).toEqual(upperResult.searchWords);
      expect(lowerResult.nicknameWords.sort()).toEqual(upperResult.nicknameWords.sort());
      expect(lowerResult.searchMetaphones.sort()).toEqual(upperResult.searchMetaphones.sort());
    });

    test('should expand Bob to include Robert-related data', () => {
      const result = generateStructuredQueryTokens('Bob');

      expect(result.searchWords).toContain('bob');
      expect(result.nicknameWords).toContain('robert');
      expect(result.nicknameMetaphones).toContain('RBRT');
    });

    test('should expand Bill to include William-related data', () => {
      const result = generateStructuredQueryTokens('Bill');

      expect(result.searchWords).toContain('bill');
      expect(result.nicknameWords).toContain('william');
    });
  });
});
