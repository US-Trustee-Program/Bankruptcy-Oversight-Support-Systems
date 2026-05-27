/**
 * Lightweight phonetic token generator for seed data.
 *
 * Generates simple phonetic tokens from text for fuzzy search support.
 * This is a simplified version suitable for seed data - production uses
 * the full phonetic-helper in backend with metaphone and nickname expansion.
 */

/**
 * Generates search tokens from a name.
 * Creates tokens for each word and character-level tokens for prefix matching.
 */
export function generateSearchTokens(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const tokens = new Set<string>();
  const normalized = text
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[̀-ͯ]/g, '') // Remove diacritical marks
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric with space
    .trim();

  // Split into words
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);

  for (const word of words) {
    // Add the whole word
    tokens.add(word);

    // Add character-level tokens for prefix matching
    for (let i = 1; i <= Math.min(word.length, 4); i++) {
      tokens.add(word.substring(0, i));
    }

    // Add simple phonetic approximations (basic consonant clusters)
    // This is a very simplified phonetic approach for seed data
    const phonetic = word
      .replace(/ph/g, 'f')
      .replace(/ck/g, 'k')
      .replace(/c([eiy])/g, 's$1')
      .replace(/c/g, 'k')
      .replace(/sh/g, 's')
      .replace(/ch/g, 'k')
      .replace(/th/g, 't')
      .replace(/[aeiou]/g, ''); // Remove vowels for consonant skeleton

    if (phonetic.length > 0 && phonetic !== word) {
      tokens.add(phonetic);
    }
  }

  return Array.from(tokens);
}
