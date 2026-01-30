import { describe, test, expect } from 'vitest';
import {
  generatePhoneticTokens,
  generateBigrams,
  isPhoneticToken,
  generateSearchTokens,
  generateQueryTokens,
  expandQueryWithNicknames,
  generatePhoneticTokensWithNicknames,
  filterCasesByDebtorNameSimilarity,
} from './phonetic-helper';
import { SyncedCase } from '@common/cams/cases';

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

  describe('filterCasesByDebtorNameSimilarity', () => {
    const mockCases: SyncedCase[] = [
      {
        caseId: '001',
        debtor: {
          name: 'Michael Johnson',
          phoneticTokens: generatePhoneticTokens('Michael Johnson'),
        },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '002',
        debtor: {
          name: 'Mike Johnson',
          phoneticTokens: generatePhoneticTokens('Mike Johnson'),
        },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '003',
        debtor: {
          name: 'Jon Smith',
          phoneticTokens: generatePhoneticTokens('Jon Smith'),
        },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '004',
        debtor: {
          name: 'John Smith',
          phoneticTokens: generatePhoneticTokens('John Smith'),
        },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '005',
        debtor: {
          name: 'Jane Doe',
          phoneticTokens: generatePhoneticTokens('Jane Doe'),
        },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '006',
        jointDebtor: {
          name: 'Sarah Connor',
          phoneticTokens: generatePhoneticTokens('Sarah Connor'),
        },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
    ];

    test('should filter cases by phonetic similarity (first names only)', () => {
      const phonetics: SyncedCase[] = [
        {
          caseId: '001',
          debtor: { name: 'Jon', phoneticTokens: generatePhoneticTokens('Jon') },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: { name: 'John', phoneticTokens: generatePhoneticTokens('John') },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '003',
          debtor: { name: 'Jane', phoneticTokens: generatePhoneticTokens('Jane') },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(phonetics, 'Jon');
      const filteredNames = filtered.map((c) => c.debtor?.name);

      expect(filteredNames).toContain('Jon');
      expect(filteredNames).toContain('John');
      expect(filteredNames).not.toContain('Jane');
    });

    test('should include joint debtor names in search', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'Sarah');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].jointDebtor?.name).toBe('Sarah Connor');
    });

    test('should handle partial name matching', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'John Sm');
      const filteredNames = filtered.map((c) => c.debtor?.name);

      expect(filteredNames).toContain('John Smith');
    });

    test('should sort results by similarity score', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'John Smith');

      const topNames = filtered.slice(0, 2).map((c) => c.debtor?.name);
      expect(topNames).toContain('John Smith');
      expect(topNames).toContain('Jon Smith');
    });

    test('should return all cases if no search query', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, '');
      expect(filtered).toEqual(mockCases);
    });

    test('should handle empty case array', () => {
      const filtered = filterCasesByDebtorNameSimilarity([], 'John');
      expect(filtered).toEqual([]);
    });

    test('should be case-insensitive', () => {
      const filtered1 = filterCasesByDebtorNameSimilarity(mockCases, 'JOHN SMITH');
      const filtered2 = filterCasesByDebtorNameSimilarity(mockCases, 'john smith');

      expect(filtered1).toEqual(filtered2);
    });
  });

  describe('Integration scenarios', () => {
    test('should handle nickname matching (Mike -> Michael)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Michael Johnson',
            phoneticTokens: generatePhoneticTokens('Michael Johnson'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Mike Johnson');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('Michael Johnson');
    });

    test('should handle phonetic matching (Jon -> John)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'John Williams',
            phoneticTokens: generatePhoneticTokens('John Williams'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search with DIFFERENT last name to ensure phonetic matching works
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jon Davis');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('John Williams');
    });

    test('should filter out false positives (Jon != Jane)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Jane Doe',
            phoneticTokens: generatePhoneticTokens('Jane Doe'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jon');
      expect(filtered).toHaveLength(0);
    });

    test('should handle international name variations', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Muhammad Ali',
            phoneticTokens: generatePhoneticTokens('Muhammad Ali'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: {
            name: 'Mohammed Ali',
            phoneticTokens: generatePhoneticTokens('Mohammed Ali'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Muhammad');
      const names = filtered.map((c) => c.debtor?.name);

      expect(names).toContain('Muhammad Ali');
      expect(names).toContain('Mohammed Ali');
    });
  });

  describe('Edge case false positives (discovered during manual testing)', () => {
    test.each([
      {
        testName: 'should NOT match Jose when searching for Jon',
        searchQuery: 'Jon',
        caseNames: ['Jose Garcia'],
        expectedNotToMatch: ['Jose Garcia'],
      },
      {
        testName: 'should NOT match Jon when searching for Jose',
        searchQuery: 'Jose',
        caseNames: ['Jon Smith', 'John Davis'],
        expectedNotToMatch: ['Jon Smith', 'John Davis'],
      },
      {
        testName: 'should NOT match Miller when searching for Mike',
        searchQuery: 'Mike',
        caseNames: ['James Miller', 'Miller Johnson'],
        expectedNotToMatch: ['James Miller', 'Miller Johnson'],
      },
    ])('$testName', ({ searchQuery, caseNames, expectedNotToMatch }) => {
      const cases: SyncedCase[] = caseNames.map((name, index) => ({
        caseId: `00${index + 1}`,
        debtor: {
          name,
          phoneticTokens: generatePhoneticTokens(name),
        },
        documentType: 'SYNCED_CASE',
      })) as SyncedCase[];

      const filtered = filterCasesByDebtorNameSimilarity(cases, searchQuery);
      const matchedNames = filtered.map((c) => c.debtor?.name);

      expectedNotToMatch.forEach((name) => {
        expect(matchedNames).not.toContain(name);
      });
    });
  });

  describe('Nickname matching - Bob/Robert and Bill/William', () => {
    test('should match Robert when searching for Bob (different last names)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Robert Smith',
            phoneticTokens: generatePhoneticTokens('Robert Smith'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search with DIFFERENT last name to test pure nickname matching
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Bob Davis');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('Robert Smith');
    });

    test('should match Bob when searching for Robert (different last names)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Bob Johnson',
            phoneticTokens: generatePhoneticTokens('Bob Johnson'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search with DIFFERENT last name to test pure nickname matching
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Robert Williams');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('Bob Johnson');
    });

    test('should match William when searching for Bill (different last names)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'William Brown',
            phoneticTokens: generatePhoneticTokens('William Brown'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search with DIFFERENT last name to test pure nickname matching
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Bill Garcia');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('William Brown');
    });

    test('should match Bill when searching for William (different last names)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Bill Anderson',
            phoneticTokens: generatePhoneticTokens('Bill Anderson'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search with DIFFERENT last name to test pure nickname matching
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'William Martinez');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('Bill Anderson');
    });
  });

  describe('International names with accents', () => {
    test('should match Spanish/Portuguese names with and without accents', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'José Garcia',
            phoneticTokens: generatePhoneticTokens('José Garcia'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: {
            name: 'Jose Garcia',
            phoneticTokens: generatePhoneticTokens('Jose Garcia'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search for José (with accent) should find both José and Jose
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jose');
      expect(filtered).toHaveLength(2);
      const names = filtered.map((c) => c.debtor?.name);
      expect(names).toContain('José Garcia');
      expect(names).toContain('Jose Garcia');
    });
  });

  describe('Misspellings', () => {
    test('should match common misspellings of names', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Michael Smith',
            phoneticTokens: generatePhoneticTokens('Michael Smith'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: {
            name: 'Micheal Johnson',
            phoneticTokens: generatePhoneticTokens('Micheal Johnson'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search for "Micheal" (common typo) should find both Michael and Micheal
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Micheal');
      expect(filtered).toHaveLength(2);
      const names = filtered.map((c) => c.debtor?.name);
      expect(names).toContain('Michael Smith');
      expect(names).toContain('Micheal Johnson');
    });

    test('should match common misspellings via phonetic codes', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Mike Smith',
            phoneticTokens: generatePhoneticTokens('Mike Smith'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: {
            name: 'Micheal Johnson',
            phoneticTokens: generatePhoneticTokens('Micheal Johnson'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '003',
          debtor: {
            name: 'Michael Brown',
            phoneticTokens: generatePhoneticTokens('Michael Brown'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search for "myke" (phonetic spelling of Mike) should find Mike via phonetic match
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'myke');
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      const names = filtered.map((c) => c.debtor?.name);
      expect(names).toContain('Mike Smith');
    });
  });

  describe('Hyphenated and compound names', () => {
    test('should match hyphenated names with and without hyphens', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Jean-Pierre Moreau',
            phoneticTokens: generatePhoneticTokens('Jean-Pierre Moreau'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: {
            name: 'Jean Pierre Moreau',
            phoneticTokens: generatePhoneticTokens('Jean Pierre Moreau'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // Search for "Jean-Pierre" should find both hyphenated and non-hyphenated
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jean-Pierre');
      expect(filtered).toHaveLength(2);
      const names = filtered.map((c) => c.debtor?.name);
      expect(names).toContain('Jean-Pierre Moreau');
      expect(names).toContain('Jean Pierre Moreau');
    });
  });
});
