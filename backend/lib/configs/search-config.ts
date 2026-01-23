/**
 * Configuration for search functionality, including phonetic search capabilities
 */

export interface PhoneticSearchConfig {
  /** Minimum similarity threshold for Jaro-Winkler matching (0.0 to 1.0) */
  similarityThreshold: number;
  /** Maximum number of results to return */
  maxResults: number;
  /** Algorithms to use for phonetic matching */
  algorithms: {
    /** Use Soundex algorithm for phonetic matching */
    soundex: boolean;
    /** Use Metaphone algorithm for phonetic matching */
    metaphone: boolean;
  };
}

export interface SearchConfig {
  /** Phonetic search configuration */
  phonetic: PhoneticSearchConfig;
}

/**
 * Get the search configuration from environment variables
 * @returns Search configuration object
 */
export function getSearchConfig(): SearchConfig {
  return {
    phonetic: {
      // Lower threshold to 0.75 to accommodate nickname matching (e.g., Mike → Michael scores 0.77)
      similarityThreshold: parseFloat(process.env.PHONETIC_SIMILARITY_THRESHOLD || '0.83'),
      maxResults: parseInt(process.env.PHONETIC_MAX_RESULTS || '100', 10),
      algorithms: {
        soundex: process.env.PHONETIC_USE_SOUNDEX?.toLowerCase() !== 'false', // Default true
        metaphone: process.env.PHONETIC_USE_METAPHONE?.toLowerCase() !== 'false', // Default true
      },
    },
  };
}
