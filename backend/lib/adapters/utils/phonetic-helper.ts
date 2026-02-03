import * as natural from 'natural';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - name-match doesn't have TypeScript definitions
import { getNameVariations } from 'name-match/src/name-normalizer';

const soundex = new natural.SoundEx();
const metaphone = new natural.Metaphone();

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s]/g, '');
}

function splitIntoWords(normalizedText: string, minLength: number = 1): string[] {
  return normalizedText.split(/\s+/).filter((word) => word.length >= minLength);
}

function isEmpty(text: string | undefined): boolean {
  return !text || text.trim().length === 0;
}

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
  if (isEmpty(text)) {
    return [];
  }

  const tokens: Set<string> = new Set();
  const words = splitIntoWords(normalizeText(text));

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
  if (isEmpty(text)) {
    return [];
  }

  const bigrams = new Set<string>();
  const words = splitIntoWords(normalizeText(text), 2);

  words.forEach((word) => {
    for (let i = 0; i <= word.length - 2; i++) {
      bigrams.add(word.substring(i, i + 2));
    }
  });

  return Array.from(bigrams);
}

/**
 * Generates all search tokens (bigrams + phonetic codes) for an array of words.
 * Used internally to create token sets for both original search terms and nicknames.
 *
 * @param words - Array of words to generate tokens for
 * @returns Set of unique tokens (bigrams lowercase, phonetics uppercase)
 */
function generateAllTokensForWords(words: string[]): Set<string> {
  const tokens = new Set<string>();
  words.forEach((word) => {
    generateBigrams(word).forEach((t) => tokens.add(t));
    generatePhoneticTokens(word).forEach((t) => tokens.add(t));
  });
  return tokens;
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
  if (isEmpty(text)) {
    return [];
  }

  return Array.from(generateAllTokensForWords([text]));
}

interface SeparatedQueryTokens {
  searchTokens: string[];
  nicknameTokens: string[];
}

/**
 * Generates query tokens for searching, with nickname expansion.
 * Returns separate arrays for original search tokens and nickname tokens,
 * enabling differential scoring (exact matches score higher than nickname matches).
 *
 * For example: "Mike Smith" → expands "Mike" to ["michael", "mikey", ...]
 *              → searchTokens: tokens for "mike", "smith"
 *              → nicknameTokens: tokens for "michael", "mikey", etc. (excluding overlaps)
 *
 * @param searchQuery - The search query (e.g., "Mike Smith")
 * @returns Object with searchTokens and nicknameTokens arrays
 */
export function generateQueryTokensWithNicknames(searchQuery: string): SeparatedQueryTokens {
  if (isEmpty(searchQuery)) {
    return { searchTokens: [], nicknameTokens: [] };
  }

  const words = splitIntoWords(normalizeText(searchQuery));
  const originalWords = new Set<string>(words);
  const nicknameWords = new Set<string>();

  words.forEach((word) => {
    try {
      const variations = getNameVariations(word) as string[];
      variations.forEach((variation: string) => {
        splitIntoWords(normalizeText(variation)).forEach((w) => {
          if (w.length > 0 && w !== word && !originalWords.has(w)) {
            nicknameWords.add(w);
          }
        });
      });
    } catch {
      // No variations available
    }
  });

  const searchTokens = generateAllTokensForWords([...originalWords]);
  const allNicknameTokens = generateAllTokensForWords([...nicknameWords]);
  const nicknameTokens = [...allNicknameTokens].filter((t) => !searchTokens.has(t));

  return {
    searchTokens: Array.from(searchTokens),
    nicknameTokens,
  };
}
