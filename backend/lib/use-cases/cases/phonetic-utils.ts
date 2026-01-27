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
const SIMILARITY_THRESHOLD = 0.83;

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
 * Generates a regex pattern for word-level prefix matching on debtor names.
 * Splits the search query into words and creates a pattern that matches any word
 * starting with any of the query words (case-insensitive).
 * For example: "mike sm" → /\b(mike|sm)/i which matches "Michael Smith", "Mike Anderson", etc.
 *
 * @param searchQuery - The search query (e.g., "mike sm")
 * @returns RegExp for word-level prefix matching
 */
export function generateDebtorNameRegexPattern(searchQuery: string): RegExp {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return new RegExp('');
  }

  const queryWords = searchQuery
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return new RegExp(`\\b(${queryWords.join('|')})`, 'i');
}

/**
 * Calculate match score for a query word against a name word.
 * Matching order: direct match → phonetic code → nickname match → similarity score
 *
 * @param queryWord - Single word from search query (normalized)
 * @param nameWord - Single word from debtor name (normalized)
 * @returns Score between 0.0 and 1.0 (1.0 = exact match)
 */
function calculateWordMatchScore(queryWord: string, nameWord: string): number {
  // 1. Direct match - exact or prefix
  if (queryWord === nameWord) {
    return 1.0;
  }
  if (nameWord.startsWith(queryWord)) {
    return 0.9;
  }

  // 2. Phonetic code match (Soundex/Metaphone)
  const queryPhoneticCodes = generatePhoneticTokens(queryWord);
  const namePhoneticCodes = generatePhoneticTokens(nameWord);
  const hasPhoneticMatch = queryPhoneticCodes.some((code) => namePhoneticCodes.includes(code));

  if (hasPhoneticMatch) {
    // Use Jaro-Winkler to filter false positives (e.g., Jon/Jane)
    const similarity = natural.JaroWinklerDistance(queryWord, nameWord);
    if (similarity >= SIMILARITY_THRESHOLD) {
      return similarity;
    }
  }

  // 3. Nickname match (e.g., Mike → Michael)
  try {
    const variations = getNameVariations(queryWord) as string[];

    for (const variation of variations) {
      // Variation might be multi-word (e.g., "Billy Bob"), split and check each
      const variationWords = variation.toLowerCase().split(/\s+/);

      for (const varWord of variationWords) {
        // Exact match with nickname variation
        if (nameWord === varWord) {
          return 0.95;
        }

        // Prefix match with nickname variation
        if (nameWord.startsWith(varWord)) {
          return 0.9;
        }
      }
    }
  } catch {
    // If nickname expansion fails, continue to final fallback
  }

  // 4. Final fallback - Jaro-Winkler similarity with original query word
  const directSimilarity = natural.JaroWinklerDistance(queryWord, nameWord);
  return directSimilarity >= SIMILARITY_THRESHOLD ? directSimilarity : 0;
}

/**
 * Calculate name match score using direct, phonetic, nickname, and similarity matching.
 * Compares each query word against each name word and returns the best score.
 *
 * @param normalizedQuery - Normalized search query (e.g., "mike smith")
 * @param targetName - Full debtor name (e.g., "Michael Smith")
 * @returns Best match score between 0.0 and 1.0
 */
function calculateNameMatchScore(normalizedQuery: string, targetName: string): number {
  const queryWords = normalizedQuery.split(/\s+/);
  const targetWords = targetName.toLowerCase().trim().split(/\s+/);

  let maxScore = 0;

  // Find the best match score across all word pairs
  for (const queryWord of queryWords) {
    for (const targetWord of targetWords) {
      const wordScore = calculateWordMatchScore(queryWord, targetWord);
      maxScore = Math.max(maxScore, wordScore);
    }
  }

  return maxScore;
}

/**
 * Filters cases based on similarity between search query and debtor names.
 * This is applied AFTER the phonetic database query to refine results.
 * Results are sorted by similarity score (best matches first).
 *
 * @param cases - Cases returned from phonetic database query
 * @param searchQuery - User's search input
 * @returns Filtered and sorted cases where debtor or joint debtor name matches the search query
 */
export function filterCasesByDebtorNameSimilarity(
  cases: SyncedCase[],
  searchQuery: string,
): SyncedCase[] {
  if (!searchQuery || !cases || cases.length === 0) return cases;

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredCases: Array<{ case: SyncedCase; score: number }> = [];

  for (const caseItem of cases) {
    let maxScore = 0;

    // Check debtor name
    if (caseItem.debtor?.name) {
      const debtorScore = calculateNameMatchScore(normalizedQuery, caseItem.debtor.name);
      maxScore = Math.max(maxScore, debtorScore);
    }

    // Check joint debtor name
    if (caseItem.jointDebtor?.name) {
      const jointDebtorScore = calculateNameMatchScore(normalizedQuery, caseItem.jointDebtor.name);
      maxScore = Math.max(maxScore, jointDebtorScore);
    }

    // Include case if it meets the SIMILARITY_THRESHOLD
    if (maxScore >= SIMILARITY_THRESHOLD) {
      filteredCases.push({ case: caseItem, score: maxScore });
    }
  }

  // Sort by score (highest first) and return cases
  return filteredCases.sort((a, b) => b.score - a.score).map((item) => item.case);
}
