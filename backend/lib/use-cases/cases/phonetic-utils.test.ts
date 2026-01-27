import { describe, it, expect } from 'vitest';
import {
  generatePhoneticTokens,
  expandQueryWithNicknames,
  generatePhoneticTokensWithNicknames,
  filterCasesByDebtorNameSimilarity,
} from './phonetic-utils';
import { SyncedCase } from '@common/cams/cases';
import { FeatureFlagSet } from '../../adapters/types/basic';

describe('Phonetic Utilities', () => {
  // Standard similarity threshold for phonetic/nickname matching

  describe('generatePhoneticTokens', () => {
    // Tests below verify that natural.SoundEx and natural.Metaphone integration works correctly
    it('should generate phonetic tokens for a single word', () => {
      const tokens = generatePhoneticTokens('Michael');
      expect(tokens).toContain('M240'); // Soundex for Michael
      expect(tokens).toContain('MKSHL'); // Metaphone for Michael
    });

    it('should generate phonetic tokens for multiple words', () => {
      const tokens = generatePhoneticTokens('John Smith');
      expect(tokens).toContain('J500'); // Soundex for John
      expect(tokens).toContain('JN'); // Metaphone for John
      expect(tokens).toContain('S530'); // Soundex for Smith
      expect(tokens).toContain('SM0'); // Metaphone for Smith
    });

    it('should handle empty input', () => {
      const tokens = generatePhoneticTokens('');
      expect(tokens).toEqual([]);
    });

    it('should handle undefined input', () => {
      const tokens = generatePhoneticTokens(undefined);
      expect(tokens).toEqual([]);
    });

    it('should handle names with special characters', () => {
      const tokens = generatePhoneticTokens("O'Brien");
      expect(tokens.length).toBeGreaterThan(0);
    });

    it('should normalize case and trim whitespace', () => {
      const tokens1 = generatePhoneticTokens('MICHAEL');
      const tokens2 = generatePhoneticTokens('michael');
      const tokens3 = generatePhoneticTokens('  Michael  ');

      // All should produce the same tokens
      expect(tokens1).toEqual(tokens2);
      expect(tokens2).toEqual(tokens3);
    });
  });

  describe('expandQueryWithNicknames', () => {
    // Tests below verify that name-match NameNormalizer integration works correctly
    it('should expand common nicknames', () => {
      const expanded = expandQueryWithNicknames('Mike');
      expect(expanded).toContain('mike');
      expect(expanded).toContain('michael'); // Mike should expand to include Michael
    });

    it('should include the original name', () => {
      const expanded = expandQueryWithNicknames('Michael');
      expect(expanded).toContain('michael');
      expect(expanded).toContain('mike'); // Michael should expand to include Mike
    });

    it('should handle empty input', () => {
      const expanded = expandQueryWithNicknames('');
      expect(expanded).toEqual([]);
    });

    it('should handle multiple words', () => {
      const expanded = expandQueryWithNicknames('Mike Johnson');
      expect(expanded).toContain('mike');
      expect(expanded).toContain('michael'); // Mike expands
      expect(expanded).toContain('johnson');
    });
  });

  describe('generatePhoneticTokensWithNicknames', () => {
    // Tests below verify library combination works correctly
    it('should combine nickname expansion with phonetic tokens', () => {
      const tokens = generatePhoneticTokensWithNicknames('Mike');
      // Should have tokens for both Mike and Michael (nickname)
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toContain('M200'); // Soundex for Mike
      expect(tokens).toContain('M240'); // Soundex for Michael
    });

    it('should handle empty input', () => {
      const tokens = generatePhoneticTokensWithNicknames('');
      expect(tokens).toEqual([]);
    });
  });

  describe('calculateJaroWinklerSimilarity', () => {
    // Tests below verify our Jaro-Winkler implementation works correctly
    it('should return 1.0 for identical strings', () => {
      const similarity = calculateJaroWinklerSimilarity('John', 'John');
      expect(similarity).toBe(1.0);
    });

    it('should return 0.0 for empty strings', () => {
      const similarity = calculateJaroWinklerSimilarity('', '');
      expect(similarity).toBe(0.0);
    });

    it('should calculate similarity for similar names', () => {
      const similarity = calculateJaroWinklerSimilarity('Jon', 'John');
      expect(similarity).toBeGreaterThan(0.8); // Should be high similarity
      expect(similarity).toBeLessThan(1.0);
    });

    it('should calculate lower similarity for different names', () => {
      const similarity = calculateJaroWinklerSimilarity('Jon', 'Jane');
      expect(similarity).toBeLessThan(0.8); // Should be lower similarity
    });

    it('should be case-insensitive', () => {
      const similarity1 = calculateJaroWinklerSimilarity('JOHN', 'john');
      const similarity2 = calculateJaroWinklerSimilarity('John', 'John');
      expect(similarity1).toBe(similarity2);
    });

    it('should handle prefix matching well', () => {
      const similarity = calculateJaroWinklerSimilarity('John', 'Johnny');
      expect(similarity).toBeGreaterThan(0.85); // Jaro-Winkler favors prefix matches
    });

    it('should handle common misspellings', () => {
      const similarity1 = calculateJaroWinklerSimilarity('Michael', 'Micheal');
      expect(similarity1).toBeGreaterThan(0.9); // Common misspelling should have high similarity

      const similarity2 = calculateJaroWinklerSimilarity('Muhammad', 'Mohammed');
      expect(similarity2).toBeGreaterThan(0.75); // Different but related names
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

    it('should filter cases by phonetic similarity (first names only)', () => {
      // Test with ONLY first names to ensure phonetic matching works
      // without relying on shared last names to pass threshold
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

      expect(filteredNames).toContain('Jon'); // Exact match
      expect(filteredNames).toContain('John'); // Phonetic match (jon->john = 0.84 or 0.93)
      expect(filteredNames).not.toContain('Jane'); // Not similar (jon->jane < 0.83)
    });

    it('should include joint debtor names in search', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'Sarah');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].jointDebtor?.name).toBe('Sarah Connor');
    });

    it('should handle partial name matching', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'John Sm');
      const filteredNames = filtered.map((c) => c.debtor?.name);

      expect(filteredNames).toContain('John Smith'); // Prefix match
    });

    it('should sort results by similarity score', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'John Smith');

      // Exact match should be first (or very close match like "Jon Smith")
      const topNames = filtered.slice(0, 2).map((c) => c.debtor?.name);
      expect(topNames).toContain('John Smith');
      // Both Jon Smith and John Smith should score high and be in top results
      expect(topNames).toContain('Jon Smith');
    });

    it('should return all cases if no search query', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, '');
      expect(filtered).toEqual(mockCases);
    });

    it('should handle empty case array', () => {
      const filtered = filterCasesByDebtorNameSimilarity([], 'John');
      expect(filtered).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const filtered1 = filterCasesByDebtorNameSimilarity(mockCases, 'JOHN SMITH');
      const filtered2 = filterCasesByDebtorNameSimilarity(mockCases, 'john smith');

      expect(filtered1).toEqual(filtered2);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle nickname matching (Mike -> Michael)', () => {
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

      // When searching for "Mike", should find "Michael"
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Mike Johnson');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('Michael Johnson');
    });

    it('should handle phonetic matching (Jon -> John)', () => {
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

    it('should filter out false positives (Jon != Jane)', () => {
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
      expect(filtered).toHaveLength(0); // Jane should not match Jon
    });

    it('should handle international name variations', () => {
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
      expect(names).toContain('Mohammed Ali'); // Should match both variations
    });
  });

  describe('Edge case false positives (discovered during manual testing)', () => {
    it('should NOT match Jose when searching for Jon', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Jose Garcia',
            phoneticTokens: generatePhoneticTokens('Jose Garcia'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jon');
      expect(filtered).toHaveLength(0); // Jose should not match Jon
    });

    it('should NOT match Jose when searching for John', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Jose Garcia',
            phoneticTokens: generatePhoneticTokens('Jose Garcia'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'John');
      expect(filtered).toHaveLength(0); // Jose should not match John
    });

    it('should NOT match Jon when searching for Jose', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'Jon Smith',
            phoneticTokens: generatePhoneticTokens('Jon Smith'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: {
            name: 'John Davis',
            phoneticTokens: generatePhoneticTokens('John Davis'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jose');
      const names = filtered.map((c) => c.debtor?.name);

      expect(names).not.toContain('Jon Smith'); // Jon should not match Jose
      expect(names).not.toContain('John Davis'); // John should not match Jose
    });

    it('should NOT match Miller when searching for Mike', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: {
            name: 'James Miller',
            phoneticTokens: generatePhoneticTokens('James Miller'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: {
            name: 'Miller Johnson',
            phoneticTokens: generatePhoneticTokens('Miller Johnson'),
          },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Mike');
      expect(filtered).toHaveLength(0); // Miller should not match Mike
    });
  });

  describe('Nickname matching - Bob/Robert and Bill/William', () => {
    it('should match Robert when searching for Bob (different last names)', () => {
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

    it('should match Bob when searching for Robert (different last names)', () => {
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

    it('should match William when searching for Bill (different last names)', () => {
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

    it('should match Bill when searching for William (different last names)', () => {
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
    it('should match Spanish/Portuguese names with and without accents', () => {
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
    it('should match common misspellings of names', () => {
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

    it('should match common misspellings via phonetic codes', () => {
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
    it('should match hyphenated names with and without hyphens', () => {
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

  describe('isPhoneticSearchEnabled', () => {
    it('should return false when no feature flags provided', () => {
      expect(isPhoneticSearchEnabled()).toBe(false);
      expect(isPhoneticSearchEnabled(null)).toBe(false);
      expect(isPhoneticSearchEnabled(undefined)).toBe(false);
    });

    it('should return false when phonetic-search-enabled flag is not present', () => {
      const featureFlags: FeatureFlagSet = {};
      expect(isPhoneticSearchEnabled(featureFlags)).toBe(false);
    });

    it('should return false when phonetic-search-enabled is false', () => {
      const featureFlags: FeatureFlagSet = {
        'phonetic-search-enabled': false,
      };
      expect(isPhoneticSearchEnabled(featureFlags)).toBe(false);
    });

    it('should return true when phonetic-search-enabled is true', () => {
      const featureFlags: FeatureFlagSet = {
        'phonetic-search-enabled': true,
      };
      expect(isPhoneticSearchEnabled(featureFlags)).toBe(true);
    });
  });
});
