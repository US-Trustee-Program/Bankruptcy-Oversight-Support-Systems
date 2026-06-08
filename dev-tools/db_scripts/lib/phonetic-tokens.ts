/**
 * Phonetic token generator for seed data.
 *
 * Implements Soundex and Metaphone directly (ported from the `natural` library,
 * MIT license, Copyright (c) 2011 Chris Umbel) so seed data produces identical
 * tokens to the production algorithm in backend/lib/adapters/utils/phonetic-helper.ts
 * without adding `natural` as a dev-tools dependency.
 *
 * MAINTENANCE: This inline implementation is necessary because dev-tools cannot directly
 * import from backend due to TypeScript/ESM module resolution constraints. The algorithms
 * are verified to produce identical output to production (see verification tests).
 * If backend's phonetic logic changes, update this file and re-verify equivalence.
 */

// ── Soundex ────────────────────────────────────────────────────────────────

function soundexTransform(token: string): string {
  return token
    .replace(/r/g, '6')
    .replace(/[mn]/g, '5')
    .replace(/l/g, '4')
    .replace(/[dt]/g, '3')
    .replace(/[cgjkqsxz]/g, '2')
    .replace(/[bfpv]/g, '1');
}

function soundexCondense(token: string): string {
  return token.replace(/(\d)\1+/g, '$1');
}

function soundexPad(token: string): string {
  return token.length < 4 ? token + '0'.repeat(3 - token.length) : token;
}

function soundex(word: string): string {
  const lower = word.toLowerCase();
  const rest = lower.substring(1);
  let transformed = soundexCondense(soundexTransform(rest));
  transformed = transformed.replace(new RegExp('^' + soundexTransform(lower.charAt(0))), '');
  return lower.charAt(0).toUpperCase() + soundexPad(transformed.replace(/\D/g, '')).substring(0, 3);
}

// ── Metaphone ──────────────────────────────────────────────────────────────

function metaphone(word: string, maxLength = 32): string {
  let t = word.toLowerCase();
  // dedup (not cc)
  t = t.replace(/([^c])\1/g, '$1');
  // drop initial letters
  if (/^(kn|gn|pn|ae|wr)/.test(t)) t = t.substring(1);
  // drop b after m at end
  t = t.replace(/mb$/, 'm');
  // ck → k
  t = t.replace(/ck/g, 'k');
  // c transform
  t = t.replace(/([^s]|^)(c)(h)/g, '$1x$3').trim();
  t = t.replace(/cia/g, 'xia');
  t = t.replace(/c([iey])/g, 's$1');
  t = t.replace(/c/g, 'k');
  // d transform
  t = t.replace(/d(ge|gy|gi)/g, 'j$1');
  t = t.replace(/d/g, 't');
  // drop g
  t = t.replace(/gh([^aeiou]|$)/g, 'h$1');
  t = t.replace(/g(n|ned)$/g, '$1');
  // transform g
  t = t.replace(/gh/g, 'f');
  t = t.replace(/([^g]|^)(g)([iey])/g, '$1j$3');
  t = t.replace(/gg/g, 'g');
  t = t.replace(/g/g, 'k');
  // drop h
  t = t.replace(/([aeiou])h([^aeiou]|$)/g, '$1$2');
  // ph → f
  t = t.replace(/ph/g, 'f');
  // q → k
  t = t.replace(/q/g, 'k');
  // s transform
  t = t.replace(/s(h|io|ia)/g, 'x$1');
  // x transform
  t = t.replace(/^x/, 's');
  t = t.replace(/x/g, 'ks');
  // t transform
  t = t.replace(/t(ia|io)/g, 'x$1');
  t = t.replace(/th/, '0');
  // drop tch
  t = t.replace(/tch/g, 'ch');
  // v → f
  t = t.replace(/v/g, 'f');
  // wh → w
  t = t.replace(/^wh/, 'w');
  // drop w before non-vowel or end
  t = t.replace(/w([^aeiou]|$)/g, '$1');
  // drop y before non-vowel or end
  t = t.replace(/y([^aeiou]|$)/g, '$1');
  // z → s
  t = t.replace(/z/, 's');
  // drop vowels (keep first char)
  t = t.charAt(0) + t.substring(1).replace(/[aeiou]/g, '');

  if (t.length >= maxLength) t = t.substring(0, maxLength);
  return t.toUpperCase();
}

// ── Helper Functions (exact copies from backend) ──────────────────────────
// These functions must remain IDENTICAL to backend/lib/adapters/utils/phonetic-helper.ts
// to ensure seed data generates the same phoneticTokens as production.

function isEmpty(text: string | undefined): boolean {
  return !text || text.trim().length === 0;
}

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/-/g, ' ') // Treat hyphens as word separators (jean-pierre → jean pierre)
    .replace(/[^a-z0-9\s]/g, '');
}

function splitIntoWords(normalizedText: string, minLength: number = 1): string[] {
  return normalizedText.split(/\s+/).filter((word) => word.length >= minLength);
}

/**
 * Generates search tokens (bigrams + Soundex + Metaphone) for a name string.
 * Matches the output of generateSearchTokens() in
 * backend/lib/adapters/utils/phonetic-helper.ts exactly.
 */
export function generateSearchTokens(text: string): string[] {
  if (isEmpty(text)) return [];

  const tokens = new Set<string>();
  const words = splitIntoWords(normalizeText(text));

  for (const word of words) {
    // Bigrams (lowercase)
    for (let i = 0; i <= word.length - 2; i++) {
      tokens.add(word.substring(i, i + 2));
    }
    // Soundex (uppercase)
    try {
      const code = soundex(word);
      if (code) tokens.add(code);
    } catch {
      // ignore
    }
    // Metaphone (uppercase)
    try {
      const code = metaphone(word);
      if (code) tokens.add(code);
    } catch {
      // ignore
    }
  }

  return Array.from(tokens);
}
