import { describe, it, expect } from 'vitest';
import {
  generatePhoneticTokens,
  expandQueryWithNicknames,
  generatePhoneticTokensWithNicknames,
  calculateJaroWinklerSimilarity,
  filterCasesByDebtorNameSimilarity,
} from './phonetic-utils';
import { SyncedCase } from '@common/cams/cases';

describe('Phonetic Utilities', () => {
  describe('generatePhoneticTokens', () => {
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
    it('should expand common nicknames', () => {
      const expanded = expandQueryWithNicknames('Mike');
      expect(expanded).toContain('mike');
      // Note: actual nickname expansion depends on name-match library behavior
    });

    it('should include the original name', () => {
      const expanded = expandQueryWithNicknames('Michael');
      expect(expanded).toContain('michael');
    });

    it('should handle empty input', () => {
      const expanded = expandQueryWithNicknames('');
      expect(expanded).toEqual([]);
    });

    it('should handle multiple words', () => {
      const expanded = expandQueryWithNicknames('Mike Johnson');
      expect(expanded).toContain('mike');
      expect(expanded).toContain('johnson');
    });
  });

  describe('generatePhoneticTokensWithNicknames', () => {
    it('should combine nickname expansion with phonetic tokens', () => {
      const tokens = generatePhoneticTokensWithNicknames('Mike');
      // Should have tokens for both Mike and potential nicknames
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens).toContain('M200'); // Soundex for Mike
    });

    it('should handle empty input', () => {
      const tokens = generatePhoneticTokensWithNicknames('');
      expect(tokens).toEqual([]);
    });
  });

  describe('calculateJaroWinklerSimilarity', () => {
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
        debtor: { name: 'Michael Johnson', phoneticTokens: [] },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '002',
        debtor: { name: 'Mike Johnson', phoneticTokens: [] },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '003',
        debtor: { name: 'Jon Smith', phoneticTokens: [] },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '004',
        debtor: { name: 'John Smith', phoneticTokens: [] },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '005',
        debtor: { name: 'Jane Doe', phoneticTokens: [] },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
      {
        caseId: '006',
        jointDebtor: { name: 'Sarah Connor', phoneticTokens: [] },
        documentType: 'SYNCED_CASE',
      } as SyncedCase,
    ];

    it('should filter cases by similarity threshold', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'Jon', 0.8);
      const filteredNames = filtered.map((c) => c.debtor?.name || c.jointDebtor?.name);

      expect(filteredNames).toContain('Jon Smith');
      expect(filteredNames).toContain('John Smith'); // Similar to Jon (with 0.80 threshold)
      expect(filteredNames).not.toContain('Jane Doe'); // Not similar enough
    });

    it('should include joint debtor names in search', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'Sarah', 0.83);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].jointDebtor?.name).toBe('Sarah Connor');
    });

    it('should handle partial name matching', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'John Sm', 0.83);
      const filteredNames = filtered.map((c) => c.debtor?.name);

      expect(filteredNames).toContain('John Smith'); // Prefix match
    });

    it('should sort results by similarity score', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, 'John Smith', 0.5);

      // Exact match should be first
      expect(filtered[0].debtor?.name).toBe('John Smith');
    });

    it('should return all cases if no search query', () => {
      const filtered = filterCasesByDebtorNameSimilarity(mockCases, '', 0.83);
      expect(filtered).toEqual(mockCases);
    });

    it('should handle empty case array', () => {
      const filtered = filterCasesByDebtorNameSimilarity([], 'John', 0.83);
      expect(filtered).toEqual([]);
    });

    it('should be case-insensitive', () => {
      const filtered1 = filterCasesByDebtorNameSimilarity(mockCases, 'JOHN SMITH', 0.83);
      const filtered2 = filterCasesByDebtorNameSimilarity(mockCases, 'john smith', 0.83);

      expect(filtered1).toEqual(filtered2);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle nickname matching (Mike -> Michael)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: { name: 'Michael Johnson', phoneticTokens: [] },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      // When searching for "Mike", should find "Michael"
      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Mike Johnson', 0.83);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('Michael Johnson');
    });

    it('should handle phonetic matching (Jon -> John)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: { name: 'John Smith', phoneticTokens: [] },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jon Smith', 0.83);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].debtor?.name).toBe('John Smith');
    });

    it('should filter out false positives (Jon != Jane)', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: { name: 'Jane Doe', phoneticTokens: [] },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Jon', 0.83);
      expect(filtered).toHaveLength(0); // Jane should not match Jon
    });

    it('should handle international name variations', () => {
      const cases: SyncedCase[] = [
        {
          caseId: '001',
          debtor: { name: 'Muhammad Ali', phoneticTokens: [] },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
        {
          caseId: '002',
          debtor: { name: 'Mohammed Ali', phoneticTokens: [] },
          documentType: 'SYNCED_CASE',
        } as SyncedCase,
      ];

      const filtered = filterCasesByDebtorNameSimilarity(cases, 'Muhammad', 0.75);
      const names = filtered.map((c) => c.debtor?.name);

      expect(names).toContain('Muhammad Ali');
      expect(names).toContain('Mohammed Ali'); // Should match both variations
    });
  });
});
