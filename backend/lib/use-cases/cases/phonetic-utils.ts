import * as natural from 'natural';
import { SyncedCase } from '@common/cams/cases';

// Initialize phonetic processors
const soundex = new natural.SoundEx();
const metaphone = new natural.Metaphone();

// Jaro-Winkler similarity threshold for matching names
const JARO_WINKLER_THRESHOLD = 0.85;

/**
 * Generates phonetic tokens (Soundex + Metaphone) for a text string.
 * Tokenizes by whitespace and generates phonetic codes for each word.
 *
 * @param text - The text string (e.g., "John Doe")
 * @returns Array of unique phonetic codes (e.g., ["J500", "JN", "D000", "T"])
 */
export function generatePhoneticTokens(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const tokens: Set<string> = new Set();

  // Normalize: uppercase, remove special characters except spaces
  const normalized = text
    .trim()
    .toUpperCase()
    .replace(/[^A-Z\s]/g, '');

  // Split into words
  const words = normalized.split(/\s+/).filter((word) => word.length > 0);

  // Generate phonetic codes for each word
  words.forEach((word) => {
    try {
      // Soundex (4-character code)
      const soundexCode = soundex.process(word);
      if (soundexCode) tokens.add(soundexCode);

      // Metaphone (variable-length code)
      const metaphoneCode = metaphone.process(word);
      if (metaphoneCode) tokens.add(metaphoneCode);
    } catch (error) {
      // Silently skip words that can't be processed
      console.warn(`Phonetic processing failed for word "${word}":`, error);
    }
  });

  return Array.from(tokens);
}

/**
 * Filters cases based on Jaro-Winkler similarity between search query and debtor names.
 * This is applied AFTER the phonetic database query to refine results.
 *
 * @param cases - Cases returned from phonetic database query
 * @param searchQuery - User's search input
 * @returns Filtered cases where debtor or joint debtor name matches the search query
 */
export function filterCasesByDebtorNameSimilarity(
  cases: SyncedCase[],
  searchQuery: string,
): SyncedCase[] {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return cases;
  }

  return cases.filter((bCase) => {
    const debtorMatch = bCase.debtor?.name && matchesDebtorName(searchQuery, bCase.debtor.name);
    const jointDebtorMatch =
      bCase.jointDebtor?.name && matchesDebtorName(searchQuery, bCase.jointDebtor.name);

    return debtorMatch || jointDebtorMatch;
  });
}

/**
 * Checks if a debtor name matches the search query using Jaro-Winkler similarity.
 * Compares each word in the search query against each word in the debtor name.
 * Returns true if ALL words in the search query have a match in the debtor name.
 *
 * @param searchQuery - User's search input (e.g., "Jon Smith")
 * @param debtorName - Debtor or joint debtor name (e.g., "John Smith")
 * @returns True if the name matches the search query
 */
function matchesDebtorName(searchQuery: string, debtorName: string): boolean {
  if (!searchQuery || !debtorName) return false;

  const queryWords = searchQuery.toLowerCase().trim().split(/\s+/);
  const nameWords = debtorName.toLowerCase().trim().split(/\s+/);

  // Every word in the search query must match at least one word in the debtor name
  return queryWords.every((queryWord) =>
    nameWords.some((nameWord) => {
      const similarity = natural.JaroWinklerDistance(queryWord, nameWord);
      return similarity >= JARO_WINKLER_THRESHOLD;
    }),
  );
}
