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
   * Checks if strings are similar with Levenshtein distance <= 1
   */
  private fuzzyMatch(text: string, pattern: string): boolean {
    // Exact match
    if (text.includes(pattern)) {
      return true;
    }

    // Check if pattern matches with 1 character edit distance
    // This is a simplified fuzzy match - production would use proper Levenshtein
    if (Math.abs(text.length - pattern.length) > 1) {
      return false;
    }

    // Check for single character difference
    let differences = 0;
    const minLength = Math.min(text.length, pattern.length);

    for (let i = 0; i < minLength; i++) {
      if (text[i] !== pattern[i]) {
        differences++;
        if (differences > 1) {
          return false;
        }
      }
    }

    // Account for length difference
    differences += Math.abs(text.length - pattern.length);

    return differences <= 1;
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
    return [...this.mockDocuments];
  }
}
