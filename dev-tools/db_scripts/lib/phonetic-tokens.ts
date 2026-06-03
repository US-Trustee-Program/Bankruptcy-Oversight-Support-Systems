/**
 * Phonetic token generator for seed data.
 *
 * Mirrors the production algorithm in backend/lib/adapters/utils/phonetic-helper.ts
 * exactly — Soundex + Metaphone codes plus bigrams — so seeded phoneticTokens
 * produce the same search behavior as runtime-indexed trustees and cases.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const natural = require('natural');

const soundex = new natural.SoundEx();
const metaphone = new natural.Metaphone();

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9\s]/g, '');
}

function splitIntoWords(text: string, minLength: number = 1): string[] {
  return text.split(/\s+/).filter((w) => w.length >= minLength);
}

/**
 * Generates search tokens (bigrams + Soundex + Metaphone) for a name string.
 * Matches the output of generateSearchTokens() in backend/lib/adapters/utils/phonetic-helper.ts.
 *
 * @param text - The name string (e.g., "John Smith")
 * @returns Array of unique tokens (bigrams lowercase, phonetics uppercase)
 */
export function generateSearchTokens(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const tokens = new Set<string>();
  const words = splitIntoWords(normalizeText(text));

  for (const word of words) {
    // Bigrams (lowercase)
    for (let i = 0; i <= word.length - 2; i++) {
      tokens.add(word.substring(i, i + 2));
    }

    // Soundex (uppercase)
    try {
      const code = soundex.process(word);
      if (code) tokens.add(code);
    } catch {
      // ignore
    }

    // Metaphone (uppercase)
    try {
      const code = metaphone.process(word);
      if (code) tokens.add(code);
    } catch {
      // ignore
    }
  }

  return Array.from(tokens);
}
