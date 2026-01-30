import * as natural from 'natural';
import { SyncedCase } from '@common/cams/cases';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - name-match doesn't have TypeScript definitions
import { getNameVariations } from 'name-match/src/name-normalizer';

const soundex = new natural.SoundEx();
const metaphone = new natural.Metaphone();

const DEFAULT_SIMILARITY_THRESHOLD = 0.83;

/**
 * Generates phonetic tokens (Soundex + Metaphone) for a text string.
 * Tokenizes by whitespace and generates phonetic codes for each word.
 *
 * Note: This function normalizes to UPPERCASE because Soundex and Metaphone
 * algorithms expect uppercase input. Other functions in this module use lowercase
 * for string comparison operations (exact match, prefix match, similarity scoring).
 *
 * @param text - The text string (e.g., "John Doe")
 * @returns Array of unique phonetic codes (e.g., ["J500", "JN", "D000", "T"])
 */
export function generatePhoneticTokens(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const tokens: Set<string> = new Set();

  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '');

  const words = normalized.split(/\s+/).filter((word) => word.length > 0);

  words.forEach((word) => {
    try {
      const soundexCode = soundex.process(word);
      if (soundexCode) tokens.add(soundexCode);

      const metaphoneCode = metaphone.process(word);
      if (metaphoneCode) tokens.add(metaphoneCode);
    } catch {
      // Ignore processing errors
    }
  });

  return Array.from(tokens);
}

/**
 * Generates bigrams (2-character n-grams) for a text string.
 * Bigrams enable substring/prefix matching in database queries.
 * For example: "John" → ["jo", "oh", "hn"]
 *
 * @param text - The text string (e.g., "John Smith")
 * @returns Array of unique lowercase bigrams
 */
export function generateBigrams(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const bigrams = new Set<string>();

  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '');

  const words = normalized.split(/\s+/).filter((word) => word.length >= 2);

  words.forEach((word) => {
    for (let i = 0; i <= word.length - 2; i++) {
      bigrams.add(word.substring(i, i + 2));
    }
  });

  return Array.from(bigrams);
}

/**
 * Determines if a token is a phonetic token (Soundex or Metaphone).
 * Phonetic tokens are uppercase alphanumeric strings with length > 1.
 * Bigrams are lowercase, so this distinguishes between the two types.
 *
 * @param token - The token to check
 * @returns True if the token is a phonetic token
 */
export function isPhoneticToken(token: string): boolean {
  return token.length > 1 && /^[A-Z0-9]+$/.test(token);
}

/**
 * Generates search tokens combining bigrams and phonetic codes.
 * This is used when storing/indexing names for hybrid search.
 * - Bigrams (lowercase): Enable substring matching
 * - Phonetic tokens (uppercase): Enable variant spelling matching
 *
 * For example: "John Smith" → ["jo", "oh", "hn", "sm", "mi", "it", "th", "J500", "JN", "S530", "SM0"]
 *
 * @param text - The text string (e.g., "John Smith")
 * @returns Array of unique tokens (bigrams lowercase, phonetics uppercase)
 */
export function generateSearchTokens(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const tokens = new Set<string>();

  generateBigrams(text).forEach((bigram) => tokens.add(bigram));
  generatePhoneticTokens(text).forEach((phoneticToken) => tokens.add(phoneticToken));

  return Array.from(tokens);
}

/**
 * Generates query tokens for searching, with nickname expansion.
 * Expands the query with nickname variations, then generates both
 * bigrams and phonetic tokens for comprehensive matching.
 *
 * For example: "Mike Smith" → expands "Mike" to ["mike", "michael", ...]
 *              → generates bigrams and phonetics for all variations
 *
 * @param searchQuery - The search query (e.g., "Mike Smith")
 * @returns Array of unique tokens for query matching
 */
export function generateQueryTokens(searchQuery: string): string[] {
  if (!searchQuery || searchQuery.trim().length === 0) {
    return [];
  }

  const tokens = new Set<string>();
  const expandedWords = expandQueryWithNicknames(searchQuery);

  expandedWords.forEach((word) => {
    generateBigrams(word).forEach((bigram) => tokens.add(bigram));
    generatePhoneticTokens(word).forEach((phoneticToken) => tokens.add(phoneticToken));
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
    try {
      const variations = getNameVariations(word) as string[];

      variations.forEach((variation: string) => {
        variation.split(' ').forEach((w) => {
          if (w.length > 0) {
            expandedWords.add(w.toLowerCase());
          }
        });
      });
    } catch {
      expandedWords.add(word.toLowerCase());
    }
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

  const expandedWords = expandQueryWithNicknames(searchQuery);

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
 * @param threshold - Minimum similarity threshold
 * @returns Score between 0.0 and 1.0 (1.0 = exact match)
 */
function calculateWordMatchScore(
  queryWord: string,
  nameWord: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): number {
  if (queryWord === nameWord) {
    return 1.0;
  }
  if (nameWord.startsWith(queryWord)) {
    return 0.9;
  }

  const queryPhoneticCodes = generatePhoneticTokens(queryWord);
  const namePhoneticCodes = generatePhoneticTokens(nameWord);
  const hasPhoneticMatch = queryPhoneticCodes.some((code) => namePhoneticCodes.includes(code));

  if (hasPhoneticMatch) {
    const similarity = natural.JaroWinklerDistance(queryWord, nameWord);
    if (similarity >= threshold) {
      return similarity;
    }
  }

  try {
    const variations = getNameVariations(queryWord) as string[];

    for (const variation of variations) {
      const variationWords = variation.toLowerCase().split(/\s+/);

      for (const varWord of variationWords) {
        if (nameWord === varWord) {
          return 0.95;
        }

        if (nameWord.startsWith(varWord)) {
          return 0.9;
        }
      }
    }
  } catch {
    // Ignore nickname expansion errors
  }

  const directSimilarity = natural.JaroWinklerDistance(queryWord, nameWord);
  return directSimilarity >= threshold ? directSimilarity : 0;
}

/**
 * Calculate name match score using direct, phonetic, nickname, and similarity matching.
 * Compares each query word against each name word and returns the best score.
 *
 * @param normalizedQuery - Normalized search query (e.g., "mike smith")
 * @param targetName - Full debtor name (e.g., "Michael Smith")
 * @param threshold - Minimum similarity threshold
 * @returns Best match score between 0.0 and 1.0
 */
function calculateNameMatchScore(
  normalizedQuery: string,
  targetName: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): number {
  const queryWords = normalizedQuery.split(/\s+/);
  const targetWords = targetName.toLowerCase().trim().split(/\s+/);

  let maxScore = 0;

  for (const queryWord of queryWords) {
    for (const targetWord of targetWords) {
      const wordScore = calculateWordMatchScore(queryWord, targetWord, threshold);
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
 * @param threshold - Minimum similarity threshold
 * @returns Filtered and sorted cases where debtor or joint debtor name matches the search query
 */
export function filterCasesByDebtorNameSimilarity(
  cases: SyncedCase[],
  searchQuery: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
): SyncedCase[] {
  if (!searchQuery || !cases || cases.length === 0) return cases;

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredCases: Array<{ case: SyncedCase; score: number }> = [];

  for (const caseItem of cases) {
    let maxScore = 0;

    if (caseItem.debtor?.name) {
      const debtorScore = calculateNameMatchScore(normalizedQuery, caseItem.debtor.name, threshold);
      maxScore = Math.max(maxScore, debtorScore);
    }

    if (caseItem.jointDebtor?.name) {
      const jointDebtorScore = calculateNameMatchScore(
        normalizedQuery,
        caseItem.jointDebtor.name,
        threshold,
      );
      maxScore = Math.max(maxScore, jointDebtorScore);
    }

    if (maxScore >= threshold) {
      filteredCases.push({ case: caseItem, score: maxScore });
    }
  }

  return filteredCases.sort((a, b) => b.score - a.score).map((item) => item.case);
}
