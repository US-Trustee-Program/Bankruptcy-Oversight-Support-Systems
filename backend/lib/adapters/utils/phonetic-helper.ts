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
    .replace(/[^a-z0-9\s]/g, '');
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

export interface StructuredQueryTokens {
  searchWords: string[];
  nicknameWords: string[];
  searchMetaphones: string[];
  nicknameMetaphones: string[];
  searchTokens: string[];
  nicknameTokens: string[];
}

/**
 * Generates Metaphone codes only for an array of words.
 * Uses Metaphone instead of Soundex for more precise phonetic matching.
 *
 * @param words - Array of words to generate Metaphone codes for
 * @returns Array of unique Metaphone codes (uppercase)
 */
function generateMetaphoneCodesForWords(words: string[]): string[] {
  const codes = new Set<string>();
  words.forEach((word) => {
    try {
      const code = metaphone.process(word);
      if (code) codes.add(code);
    } catch {
      // Ignore processing errors
    }
  });
  return Array.from(codes);
}

/**
 * Generates structured query tokens for word-level name matching.
 * This function exposes search words, nickname words, and Metaphone codes separately,
 * enabling more precise matching algorithms that can distinguish between:
 * - Exact word matches
 * - Nickname relationships (Mike → Michael)
 * - Phonetic similarity (Jon → John)
 * - Phonetic prefix matches (Jon → Johnson)
 *
 * Uses Metaphone only (not Soundex) for phonetic matching as it provides
 * more precise phonetic similarity detection.
 *
 * @param searchQuery - The search query (e.g., "Mike Smith")
 * @returns StructuredQueryTokens with words, metaphones, and combined tokens
 *
 * @example
 * generateStructuredQueryTokens("Mike Smith")
 * // Returns:
 * // {
 * //   searchWords: ["mike", "smith"],
 * //   nicknameWords: ["michael", "mikey", ...],
 * //   searchMetaphones: ["MK", "SM0"],
 * //   nicknameMetaphones: ["MXL", ...],
 * //   searchTokens: ["mi", "ik", "ke", "sm", "it", "th", "M200", "MK", "S530", "SM0"],
 * //   nicknameTokens: ["ic", "ch", "ha", "ae", "el", "M240", "MXL", ...]
 * // }
 */
export function generateStructuredQueryTokens(searchQuery: string): StructuredQueryTokens {
  if (isEmpty(searchQuery)) {
    return {
      searchWords: [],
      nicknameWords: [],
      searchMetaphones: [],
      nicknameMetaphones: [],
      searchTokens: [],
      nicknameTokens: [],
    };
  }

  const words = splitIntoWords(normalizeText(searchQuery));
  const originalWords = new Set<string>(words);
  const nicknameWords = new Set<string>();

  // Expand nicknames using name-match library
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

  // Generate combined tokens for pre-filter optimization (uses MongoDB index)
  const searchTokensSet = generateAllTokensForWords([...originalWords]);
  const allNicknameTokensSet = generateAllTokensForWords([...nicknameWords]);
  const nicknameTokens = [...allNicknameTokensSet].filter((t) => !searchTokensSet.has(t));

  // Generate Metaphone codes only (more precise than Soundex)
  const searchMetaphones = generateMetaphoneCodesForWords([...originalWords]);
  const allNicknameMetaphones = generateMetaphoneCodesForWords([...nicknameWords]);
  const nicknameMetaphones = allNicknameMetaphones.filter((m) => !searchMetaphones.includes(m));

  return {
    searchWords: [...originalWords],
    nicknameWords: [...nicknameWords],
    searchMetaphones,
    nicknameMetaphones,
    searchTokens: Array.from(searchTokensSet),
    nicknameTokens,
  };
}
