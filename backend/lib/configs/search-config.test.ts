import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSearchConfig } from './search-config';

describe('Search Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getSearchConfig', () => {
    describe('phonetic search configuration', () => {
      it('should return default similarity threshold of 0.83', () => {
        delete process.env.PHONETIC_SIMILARITY_THRESHOLD;
        const config = getSearchConfig();
        expect(config.phonetic.similarityThreshold).toBe(0.83);
      });

      it('should use custom similarity threshold from environment', () => {
        process.env.PHONETIC_SIMILARITY_THRESHOLD = '0.85';
        const config = getSearchConfig();
        expect(config.phonetic.similarityThreshold).toBe(0.85);
      });

      it('should return default max results of 100', () => {
        delete process.env.PHONETIC_MAX_RESULTS;
        const config = getSearchConfig();
        expect(config.phonetic.maxResults).toBe(100);
      });

      it('should use custom max results from environment', () => {
        process.env.PHONETIC_MAX_RESULTS = '50';
        const config = getSearchConfig();
        expect(config.phonetic.maxResults).toBe(50);
      });

      it('should enable soundex algorithm by default', () => {
        delete process.env.PHONETIC_USE_SOUNDEX;
        const config = getSearchConfig();
        expect(config.phonetic.algorithms.soundex).toBe(true);
      });

      it('should enable metaphone algorithm by default', () => {
        delete process.env.PHONETIC_USE_METAPHONE;
        const config = getSearchConfig();
        expect(config.phonetic.algorithms.metaphone).toBe(true);
      });

      it('should disable soundex when explicitly set to false', () => {
        process.env.PHONETIC_USE_SOUNDEX = 'false';
        const config = getSearchConfig();
        expect(config.phonetic.algorithms.soundex).toBe(false);
      });

      it('should disable metaphone when explicitly set to false', () => {
        process.env.PHONETIC_USE_METAPHONE = 'false';
        const config = getSearchConfig();
        expect(config.phonetic.algorithms.metaphone).toBe(false);
      });

      it('should handle invalid similarity threshold gracefully', () => {
        process.env.PHONETIC_SIMILARITY_THRESHOLD = 'invalid';
        const config = getSearchConfig();
        // parseFloat('invalid') returns NaN
        expect(isNaN(config.phonetic.similarityThreshold)).toBe(true);
      });

      it('should handle invalid max results gracefully', () => {
        process.env.PHONETIC_MAX_RESULTS = 'invalid';
        const config = getSearchConfig();
        // parseInt('invalid', 10) returns NaN
        expect(isNaN(config.phonetic.maxResults)).toBe(true);
      });

      it('should handle case-insensitive boolean values', () => {
        process.env.PHONETIC_USE_SOUNDEX = 'FALSE';
        process.env.PHONETIC_USE_METAPHONE = 'False';
        const config = getSearchConfig();
        expect(config.phonetic.algorithms.soundex).toBe(false);
        expect(config.phonetic.algorithms.metaphone).toBe(false);
      });

      it('should treat any non-"false" value as true for algorithms', () => {
        process.env.PHONETIC_USE_SOUNDEX = 'true';
        process.env.PHONETIC_USE_METAPHONE = 'yes';
        const config = getSearchConfig();
        expect(config.phonetic.algorithms.soundex).toBe(true);
        expect(config.phonetic.algorithms.metaphone).toBe(true);
      });
    });
  });
});
