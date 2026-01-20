import natural from 'natural';
import nameMatch from 'name-match';
import { SyncedCase } from '../../../common/src/cams/cases';

// Initialize phonetic algorithms
const soundex = natural.SoundEx;
const metaphone = natural.Metaphone;

/**
 * Generate phonetic tokens for a given text using Soundex and Metaphone algorithms
 * @param text The text to generate phonetic tokens for
 * @returns Array of phonetic tokens
 */
export function generatePhoneticTokens(text: string | undefined): string[] {
  if (!text) return [];

  // Normalize and tokenize text
  const normalizedText = text.toLowerCase().trim();
  const words = normalizedText.split(/\s+/).filter((word) => word.length > 0);
  const tokens = new Set<string>();

  for (const word of words) {
    // Generate Soundex token
    const soundexToken = soundex.process(word);
    if (soundexToken) {
      tokens.add(soundexToken);
    }

    // Generate Metaphone token
    const metaphoneToken = metaphone.process(word);
    if (metaphoneToken) {
      tokens.add(metaphoneToken);
    }
  }

  return Array.from(tokens);
}

/**
 * Expand search query with nickname variations using name-match library
 * @param searchQuery The search query to expand
 * @returns Array of name variations including nicknames
 */
export function expandQueryWithNicknames(searchQuery: string): string[] {
  if (!searchQuery) return [];

  const expandedNames = new Set<string>();
  const words = searchQuery.toLowerCase().trim().split(/\s+/);

  for (const word of words) {
    // Add the original word
    expandedNames.add(word);

    // Use name-match to get nickname variations
    try {
      const nicknames = nameMatch.getNicknames(word);
      if (nicknames && Array.isArray(nicknames)) {
        nicknames.forEach((nickname) => expandedNames.add(nickname.toLowerCase()));
      }
    } catch (error) {
      // If name-match fails for a word, just use the original
      console.warn(`Failed to get nicknames for ${word}:`, error);
    }
  }

  return Array.from(expandedNames);
}

/**
 * Generate phonetic tokens combined with nickname expansion
 * @param text The text to process
 * @returns Array of all phonetic tokens including nickname variations
 */
export function generatePhoneticTokensWithNicknames(text: string): string[] {
  if (!text) return [];

  const tokens = new Set<string>();

  // Get nickname variations
  const expandedWords = expandQueryWithNicknames(text);

  // Generate phonetic tokens for each variation
  for (const word of expandedWords) {
    const wordTokens = generatePhoneticTokens(word);
    wordTokens.forEach((token) => tokens.add(token));
  }

  // Also include phonetic tokens for the full original text
  const fullTextTokens = generatePhoneticTokens(text);
  fullTextTokens.forEach((token) => tokens.add(token));

  return Array.from(tokens);
}

/**
 * Calculate Jaro-Winkler similarity between two strings
 * @param s1 First string
 * @param s2 Second string
 * @returns Similarity score between 0.0 and 1.0
 */
export function calculateJaroWinklerSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0.0;

  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  if (str1 === str2) return 1.0;

  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 || len2 === 0) return 0.0;

  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  let matches = 0;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || str1[i] !== str2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  // Calculate Jaro similarity
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  // Calculate Jaro-Winkler similarity
  let prefixLength = 0;
  for (let i = 0; i < Math.min(len1, len2, 4); i++) {
    if (str1[i] === str2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  const p = 0.1; // scaling factor (standard is 0.1)
  const jaroWinkler = jaro + prefixLength * p * (1 - jaro);

  return Math.min(1.0, jaroWinkler);
}

/**
 * Check if one string is a prefix of another (for partial matching)
 * @param searchTerm The search term (potential prefix)
 * @param target The target string to check against
 * @returns True if searchTerm is a prefix of target
 */
function isPrefixMatch(searchTerm: string, target: string): boolean {
  const normalizedSearch = searchTerm.toLowerCase().trim();
  const normalizedTarget = target.toLowerCase().trim();

  // Check if the search term is a prefix of any word in the target
  const targetWords = normalizedTarget.split(/\s+/);
  const searchWords = normalizedSearch.split(/\s+/);

  // Each search word should be a prefix of some word in the target
  return searchWords.every((searchWord) =>
    targetWords.some((targetWord) => targetWord.startsWith(searchWord)),
  );
}

/**
 * Filter cases by debtor name similarity using Jaro-Winkler algorithm
 * @param cases Array of cases to filter
 * @param searchQuery The search query to match against
 * @param threshold Minimum similarity threshold (default 0.83)
 * @returns Filtered array of cases matching the similarity criteria
 */
export function filterCasesByDebtorNameSimilarity(
  cases: SyncedCase[],
  searchQuery: string,
  threshold: number = 0.83,
): SyncedCase[] {
  if (!searchQuery || !cases || cases.length === 0) return cases;

  const normalizedQuery = searchQuery.toLowerCase().trim();
  const filteredCases: Array<{ case: SyncedCase; score: number }> = [];

  for (const caseItem of cases) {
    let maxScore = 0;

    // Check debtor name
    if (caseItem.debtor?.name) {
      const debtorScore = calculateJaroWinklerSimilarity(normalizedQuery, caseItem.debtor.name);
      maxScore = Math.max(maxScore, debtorScore);

      // Also check for prefix matching (partial name search)
      if (isPrefixMatch(normalizedQuery, caseItem.debtor.name)) {
        maxScore = Math.max(maxScore, 0.9); // Give high score for prefix matches
      }
    }

    // Check joint debtor name
    if (caseItem.jointDebtor?.name) {
      const jointDebtorScore = calculateJaroWinklerSimilarity(
        normalizedQuery,
        caseItem.jointDebtor.name,
      );
      maxScore = Math.max(maxScore, jointDebtorScore);

      // Also check for prefix matching
      if (isPrefixMatch(normalizedQuery, caseItem.jointDebtor.name)) {
        maxScore = Math.max(maxScore, 0.9);
      }
    }

    // Include case if it meets the threshold
    if (maxScore >= threshold) {
      filteredCases.push({ case: caseItem, score: maxScore });
    }
  }

  // Sort by score (highest first) and return cases
  return filteredCases.sort((a, b) => b.score - a.score).map((item) => item.case);
}

/**
 * Check if phonetic search should be used based on configuration
 * @param config The search configuration
 * @returns True if phonetic search is enabled
 */
export function isPhoneticSearchEnabled(config?: { phonetic?: { enabled?: boolean } }): boolean {
  // Default to false if no config provided
  if (!config) return false;

  // Check for phonetic search configuration
  return config.phonetic?.enabled === true;
}
