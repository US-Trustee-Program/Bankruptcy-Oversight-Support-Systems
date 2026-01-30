import * as natural from 'natural';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - name-match doesn't have TypeScript definitions
import { getNameVariations } from 'name-match/src/name-normalizer';

const soundex = new natural.SoundEx();
const metaphone = new natural.Metaphone();

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
