import * as natural from 'natural';
import * as nameMatch from 'name-match';
import { SyncedCase } from '@common/cams/cases';
import { FeatureFlagSet } from '../../adapters/types/basic';

// Initialize phonetic algorithms
const soundexAlgorithm = new natural.SoundEx();
const metaphoneAlgorithm = new natural.Metaphone();
export const SIMILARITY_THRESHOLD = 0.83;

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
    const soundexToken = soundexAlgorithm.process(word);
    if (soundexToken) {
      tokens.add(soundexToken);
    }

    // Generate Metaphone token
    const metaphoneToken = metaphoneAlgorithm.process(word);
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
    // Use NameNormalizer to get nickname variations
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const variations = (nameMatch.NameNormalizer?.getNameVariations?.(word) as string[]) ??
        (nameMatch.default?.NameNormalizer?.getNameVariations?.(word) as string[]) ?? [word];

      if (variations && Array.isArray(variations)) {
        variations.forEach((variant: string) => expandedNames.add(variant.toLowerCase()));
      }
    } catch (_error) {
      // If name-match fails for a word, just use the original
      // This is expected for non-name words
      expandedNames.add(word);
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
 * Calculate match score for a query word against a name word.
 * Matching order: direct match -> phonetic code -> nickname match -> similarity score
 *
 * @param queryWord Single word from search query
 * @param nameWord Single word from debtor name
 * @returns Score between 0.0 and 1.0 (1.0 = exact match)
 */
function calculateWordMatchScore(queryWord: string, nameWord: string): number {
  const normalizedQuery = queryWord.toLowerCase();
  const normalizedName = nameWord.toLowerCase();

  // 1. Direct match - exact or prefix
  if (normalizedQuery === normalizedName) {
    return 1.0;
  }
  if (normalizedName.startsWith(normalizedQuery)) {
    return 0.9;
  }

  // 2. Phonetic code match (Soundex/Metaphone)
  const queryPhoneticCodes = generatePhoneticTokens(queryWord);
  const namePhoneticCodes = generatePhoneticTokens(nameWord);
  const hasPhoneticMatch = queryPhoneticCodes.some((code) => namePhoneticCodes.includes(code));

  if (hasPhoneticMatch) {
    // Use Jaro-Winkler to filter false positives (e.g., Jon/Jane)
    const similarity = natural.JaroWinklerDistance(normalizedQuery, normalizedName);
    if (similarity >= SIMILARITY_THRESHOLD) {
      return similarity;
    }
  }

  // 3. Nickname match (e.g., Mike → Michael)
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const variations = (nameMatch.NameNormalizer?.getNameVariations?.(queryWord) as string[]) ??
      (nameMatch.default?.NameNormalizer?.getNameVariations?.(queryWord) as string[]) ?? [
        queryWord,
      ];

    for (const variation of variations) {
      // Variation might be multi-word (e.g., "Billy Bob"), split and check each
      const variationWords = variation.toLowerCase().split(/\s+/);

      for (const varWord of variationWords) {
        // Exact match with nickname variation
        if (normalizedName === varWord) {
          return 0.95;
        }

        // Prefix match with nickname variation
        if (normalizedName.startsWith(varWord)) {
          return 0.9;
        }
      }
    }
  } catch (_error) {
    // If nickname expansion fails, continue to final fallback
  }

  // 4. Final fallback - Jaro-Winkler similarity with original query word
  const directSimilarity = natural.JaroWinklerDistance(normalizedQuery, normalizedName);
  return directSimilarity >= SIMILARITY_THRESHOLD ? directSimilarity : 0;
}

/**
 * Calculate name match score using direct, phonetic, nickname, and similarity matching.
 * Compares each query word against each name word and returns the best score.
 *
 * @param searchQuery Full search query (e.g., "Mike Smith")
 * @param targetName Full debtor name (e.g., "Michael Smith")
 * @returns Best match score between 0.0 and 1.0
 */
function calculateNameMatchScore(searchQuery: string, targetName: string): number {
  const queryWords = searchQuery.toLowerCase().trim().split(/\s+/);
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
 * Filter cases by debtor name similarity using nickname-aware matching
 * @param cases Array of cases to filter
 * @param searchQuery The search query to match against
 * @param threshold Minimum similarity threshold (default 0.83 to prevent false positives while allowing international variations)
 * @returns Filtered array of cases matching the similarity criteria, sorted by match score
 */
export function filterCasesByDebtorNameSimilarity(
  cases: SyncedCase[],
  searchQuery: string,
  threshold: number = SIMILARITY_THRESHOLD,
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

    // Include case if it meets the threshold
    if (maxScore >= threshold) {
      filteredCases.push({ case: caseItem, score: maxScore });
    }
  }

  // Sort by score (highest first) and return cases
  return filteredCases.sort((a, b) => b.score - a.score).map((item) => item.case);
}

/**
 * Check if phonetic search is enabled in the feature flags
 * @param featureFlags The feature flags object from the application context
 * @returns True if phonetic search is enabled, false otherwise
 */
export function isPhoneticSearchEnabled(featureFlags?: FeatureFlagSet | null): boolean {
  return featureFlags?.['phonetic-search-enabled'] === true;
}
