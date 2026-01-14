import { SearchGateway } from '../../use-cases/gateways.types';
import { DebtorSearchDocument, SearchResult, SearchOptions } from '../../adapters/types/search';

/**
 * Mock implementation of SearchGateway for testing
 * Stores documents in memory and performs simple string matching
 */
export class MockAzureSearchGateway implements SearchGateway {
  private mockDocuments: DebtorSearchDocument[] = [];
  private indexCreated: boolean = false;

  /**
   * Simulates index creation
   */
  async createIndex(): Promise<void> {
    this.indexCreated = true;
  }

  /**
   * Simulates index deletion
   */
  async deleteIndex(): Promise<void> {
    this.indexCreated = false;
    this.mockDocuments = [];
  }

  /**
   * Stores documents in memory
   */
  async uploadDocuments<T>(documents: T[]): Promise<void> {
    if (!this.indexCreated) {
      throw new Error('Index must be created before uploading documents');
    }
    this.mockDocuments = documents as DebtorSearchDocument[];
  }

  /**
   * Performs simple in-memory search
   * Supports fuzzy matching with basic Levenshtein-like logic
   */
  async search<T>(searchText: string, options?: SearchOptions): Promise<SearchResult<T>> {
    if (!this.indexCreated) {
      return { results: [], count: 0 };
    }

    const searchLower = searchText.toLowerCase();
    const isFuzzy = options?.fuzzy || false;

    // Filter documents based on search text
    let filtered = this.mockDocuments.filter((doc) => {
      const nameLower = doc.name.toLowerCase();
      const firstNameLower = doc.firstName?.toLowerCase() || '';
      const lastNameLower = doc.lastName?.toLowerCase() || '';

      if (isFuzzy) {
        // Simple fuzzy matching: allow 1 character difference
        return (
          this.fuzzyMatch(nameLower, searchLower) ||
          this.fuzzyMatch(firstNameLower, searchLower) ||
          this.fuzzyMatch(lastNameLower, searchLower)
        );
      }

      // Exact substring match
      return (
        nameLower.includes(searchLower) ||
        firstNameLower.includes(searchLower) ||
        lastNameLower.includes(searchLower)
      );
    });

    // Apply pagination
    const skip = options?.skip || 0;
    const top = options?.top || 25;
    const totalCount = filtered.length;
    filtered = filtered.slice(skip, skip + top);

    // Apply field selection if specified
    if (options?.select && options.select.length > 0) {
      filtered = filtered.map((doc) => {
        const selected: any = {};
        options.select!.forEach((field) => {
          if (field in doc) {
            selected[field] = (doc as any)[field];
          }
        });
        return selected;
      });
    }

    return {
      results: filtered as T[],
      count: totalCount,
    };
  }

  /**
   * Returns the count of documents in memory
   */
  async getDocumentCount(): Promise<number> {
    return this.mockDocuments.length;
  }

  /**
   * Releases resources (no-op for mock)
   */
  async release(): Promise<void> {
    // No cleanup needed
  }

  /**
   * Simple fuzzy matching that allows for minor typos
   * Checks if any substring of the text matches the pattern with edit distance <= 1
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    // Exact match
    if (text.includes(pattern)) {
      return true;
    }

    // Try to find a fuzzy match for the pattern anywhere in the text
    // For each possible substring of the text that is close in length to the pattern
    const patternLen = pattern.length;
    const textLen = text.length;

    // Check substrings of text that are within 1 character of pattern length
    // We need to be more restrictive to avoid false positives
    for (let start = 0; start < textLen; start++) {
      // Only check substring lengths that make sense
      const maxLen = Math.min(patternLen + 1, textLen - start);
      const minLen = Math.max(1, patternLen - 1);

      for (let len = minLen; len <= maxLen; len++) {
        if (start + len > textLen) continue;
        const substring = text.substring(start, start + len);

        // Calculate edit distance between substring and pattern
        const distance = this.calculateEditDistance(substring, pattern);
        if (distance <= 1) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate the Levenshtein edit distance between two strings
   */
  private calculateEditDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Create a 2D array for dynamic programming
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // Initialize first row and column
    for (let i = 0; i <= m; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= n; j++) {
      dp[0][j] = j;
    }

    // Fill the dp table
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] =
            1 +
            Math.min(
              dp[i - 1][j], // deletion
              dp[i][j - 1], // insertion
              dp[i - 1][j - 1], // substitution
            );
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Helper method to reset the mock state (useful for tests)
   */
  reset(): void {
    this.mockDocuments = [];
    this.indexCreated = false;
  }

  /**
   * Helper method to get all documents (useful for tests)
   */
  getAllDocuments(): DebtorSearchDocument[] {
    // Return a deep copy to prevent external modification
    return this.mockDocuments.map((doc) => ({ ...doc }));
  }
}
