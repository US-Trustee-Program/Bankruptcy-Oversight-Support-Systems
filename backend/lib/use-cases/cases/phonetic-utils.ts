import * as natural from 'natural';
import { SyncedCase } from '@common/cams/cases';
// @ts-expect-error - name-match doesn't have TypeScript definitions
import { getNameVariations } from 'name-match/src/name-normalizer';

// Initialize phonetic processors
const soundex = new natural.SoundEx();
const metaphone = new natural.Metaphone();

// Jaro-Winkler similarity threshold for matching names
// Lowered from 0.85 to 0.83 to support nickname matching (Mike/Michael)
// while still filtering false positives (Jon/Jane at 0.78)
const JARO_WINKLER_THRESHOLD = 0.83;

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
    } catch {
      // eslint-disable-next-line no-empty
      // Silently skip words that can't be processed (e.g., numbers, special characters)
    }
  });

  return Array.from(tokens);
}

/**
 * Expands a search query with nickname variations.
 * For example: "Mike Johnson" → ["mike", "michael", "mikey", "mick", "johnson"]
 *
 * @param searchQuery - The search query (e.g., "Mike Johnson")
 * @returns Array of unique words including all nickname variations
 */
export function expandQueryWithNicknames(searchQuery: string): string[] {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return [];
  }

  const words = searchQuery.trim().split(/\s+/);
  const expandedWords = new Set<string>();

  words.forEach((word) => {
    // Get all name variations for this word (includes original + nicknames)
    const variations = getNameVariations(word) as string[];

    // Add all variations, splitting multi-word variations if needed
    variations.forEach((variation: string) => {
      variation.split(' ').forEach((w) => {
        if (w.length > 0) {
          expandedWords.add(w.toLowerCase());
        }
      });
    });
  });

  return Array.from(expandedWords);
}

/**
 * Generates phonetic tokens for a search query with nickname expansion.
 * Expands the query with nickname variations, then generates phonetic codes for all variations.
 * For example: "Mike Johnson" → expands to ["mike", "michael", "mikey", "mick", "johnson"]
 *              → generates tokens for all variations
 *
 * @param searchQuery - The search query (e.g., "Mike Johnson")
 * @returns Array of unique phonetic codes for query + nickname variations
 */
export function generatePhoneticTokensWithNicknames(searchQuery: string): string[] {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return [];
  }

  // Expand query with nickname variations
  const expandedWords = expandQueryWithNicknames(searchQuery);

  // Generate phonetic tokens for all expanded words
  const allTokens = new Set<string>();
  expandedWords.forEach((word) => {
    const tokens = generatePhoneticTokens(word);
    tokens.forEach((token) => allTokens.add(token));
  });

  return Array.from(allTokens);
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
 * Checks if a debtor name matches the search query using prefix matching, nickname expansion,
 * and Jaro-Winkler similarity. Compares each word in the search query against each word in
 * the debtor name. Returns true if ALL words in the search query have a match in the debtor name.
 * Supports partial word matching (e.g., "sm" matches "Smith", "jon" matches "John") and
 * nickname matching (e.g., "Mike" matches "Michael", "Bill" matches "William").
 *
 * @param searchQuery - User's search input (e.g., "Mike Smith" or "bill sm")
 * @param debtorName - Debtor or joint debtor name (e.g., "Michael Smith")
 * @returns True if the name matches the search query
 */
function matchesDebtorName(searchQuery: string, debtorName: string): boolean {
  if (!searchQuery || !debtorName) return false;

  const queryWords = searchQuery.toLowerCase().trim().split(/\s+/);
  const nameWords = debtorName.toLowerCase().trim().split(/\s+/);

  // Every word in the search query must match at least one word in the debtor name
  return queryWords.every((queryWord) => {
    // Expand this query word with nickname variations
    const queryWordVariations = getNameVariations(queryWord) as string[];

    return nameWords.some((nameWord) => {
      // Check prefix match first (for partial typing like "sm" matching "smith")
      if (nameWord.startsWith(queryWord)) {
        return true;
      }

      // Check if nameWord matches any of the query word's nickname variations
      for (const variation of queryWordVariations) {
        // Variation might be multi-word, split and check each word
        const variationWords = variation.toLowerCase().split(/\s+/);

        for (const varWord of variationWords) {
          // Exact match with nickname variation
          if (nameWord === varWord) {
            return true;
          }

          // Prefix match with nickname variation
          if (nameWord.startsWith(varWord)) {
            return true;
          }

          // Jaro-Winkler similarity with nickname variation
          const similarity = natural.JaroWinklerDistance(varWord, nameWord);
          if (similarity >= JARO_WINKLER_THRESHOLD) {
            return true;
          }
        }
      }

      // Fall back to Jaro-Winkler similarity with original query word
      const similarity = natural.JaroWinklerDistance(queryWord, nameWord);
      return similarity >= JARO_WINKLER_THRESHOLD;
    });
  });
}
