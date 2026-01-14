import { SearchGateway } from '../../use-cases/gateways.types';
import {
  DebtorSearchDocument,
  SearchResult,
  SearchOptions,
  SearchResultItem,
  FacetResult,
  SuggestionResult,
} from '../../adapters/types/search';

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
   * Performs enhanced in-memory search with scoring, highlighting, and facets
   * Supports fuzzy matching with basic Levenshtein-like logic
   */
  async search<T>(searchText: string, options?: SearchOptions): Promise<SearchResult<T>> {
    if (!this.indexCreated) {
      return { results: [], count: 0 };
    }

    const searchLower = searchText.toLowerCase();
    const isFuzzy = options?.fuzzy || false;

    // Enhanced search with scoring and highlighting
    const searchResults: Array<{
      doc: DebtorSearchDocument;
      score: number;
      highlights: Record<string, string[]>;
    }> = [];

    // Search and score documents
    this.mockDocuments.forEach((doc) => {
      const nameLower = doc.name.toLowerCase();
      const firstNameLower = doc.firstName?.toLowerCase() || '';
      const lastNameLower = doc.lastName?.toLowerCase() || '';
      const cityLower = doc.city?.toLowerCase() || '';
      const stateLower = doc.state?.toLowerCase() || '';

      let score = 0;
      const highlights: Record<string, string[]> = {};

      // Check name field
      if (isFuzzy) {
        if (this.fuzzyMatch(nameLower, searchLower)) {
          score += 10;
          highlights.name = [this.highlightMatch(doc.name, searchText)];
        }
        if (this.fuzzyMatch(firstNameLower, searchLower)) {
          score += 8;
          highlights.firstName = [this.highlightMatch(doc.firstName || '', searchText)];
        }
        if (this.fuzzyMatch(lastNameLower, searchLower)) {
          score += 9;
          highlights.lastName = [this.highlightMatch(doc.lastName || '', searchText)];
        }
      } else {
        // Exact match scoring
        if (nameLower.includes(searchLower)) {
          score += nameLower === searchLower ? 15 : 10;
          highlights.name = [this.highlightMatch(doc.name, searchText)];
        }
        if (firstNameLower.includes(searchLower)) {
          score += firstNameLower === searchLower ? 12 : 8;
          highlights.firstName = [this.highlightMatch(doc.firstName || '', searchText)];
        }
        if (lastNameLower.includes(searchLower)) {
          score += lastNameLower === searchLower ? 13 : 9;
          highlights.lastName = [this.highlightMatch(doc.lastName || '', searchText)];
        }
      }

      // Check city/state for bonus scoring
      if (cityLower.includes(searchLower)) {
        score += 3;
        highlights.city = [this.highlightMatch(doc.city || '', searchText)];
      }
      if (stateLower.includes(searchLower)) {
        score += 2;
        highlights.state = [this.highlightMatch(doc.state || '', searchText)];
      }

      if (score > 0) {
        searchResults.push({ doc, score, highlights });
      }
    });

    // Sort by score (highest first)
    searchResults.sort((a, b) => b.score - a.score);

    // Apply filters if specified
    let filteredResults = searchResults;
    if (options?.filter) {
      filteredResults = this.applyFilter(searchResults, options.filter);
    }

    // Calculate facets if requested
    let facets: Record<string, FacetResult[]> | undefined;
    if (options?.facets && options.facets.length > 0) {
      facets = this.calculateFacets(filteredResults, options.facets);
    }

    // Apply pagination
    const skip = options?.skip || 0;
    const top = options?.top || 25;
    const totalCount = filteredResults.length;
    const paginatedResults = filteredResults.slice(skip, skip + top);

    // Build response
    let results: T[];
    let items: SearchResultItem<T>[] | undefined;

    // If highlighting was requested, include items with scores and highlights
    if (options?.highlight && options.highlight.length > 0) {
      items = paginatedResults.map((r) => ({
        document: this.selectFields(r.doc, options?.select) as T,
        score: r.score,
        highlights: r.highlights,
      }));
      results = items.map((item) => item.document);
    } else {
      // Simple results without highlighting
      results = paginatedResults.map((r) => this.selectFields(r.doc, options?.select) as T);
    }

    return {
      results,
      count: totalCount,
      facets,
      items,
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

  /**
   * Provides autocomplete suggestions based on partial text
   */
  async suggest(searchText: string, options?: SearchOptions): Promise<SuggestionResult[]> {
    if (!this.indexCreated || searchText.length < 2) {
      return [];
    }

    const searchLower = searchText.toLowerCase();
    const suggestions = new Set<string>();
    const top = options?.top || 10;

    // Collect unique suggestions from name fields
    this.mockDocuments.forEach((doc) => {
      // Check full name
      if (doc.name.toLowerCase().startsWith(searchLower)) {
        suggestions.add(doc.name);
      }
      // Check first name
      if (doc.firstName && doc.firstName.toLowerCase().startsWith(searchLower)) {
        suggestions.add(doc.firstName);
      }
      // Check last name
      if (doc.lastName && doc.lastName.toLowerCase().startsWith(searchLower)) {
        suggestions.add(doc.lastName);
      }
    });

    // Convert to array and limit results
    const suggestionArray = Array.from(suggestions).slice(0, top);

    // Return with highlighting
    return suggestionArray.map((text) => ({
      text,
      highlightedText: this.highlightMatch(text, searchText),
    })) as SuggestionResult[];
  }

  /**
   * Highlights matching text with <em> tags
   */
  private highlightMatch(text: string, searchText: string): string {
    if (!text) return text;

    const regex = new RegExp(`(${searchText})`, 'gi');
    return text.replace(regex, '<em>$1</em>');
  }

  /**
   * Applies filter expressions (simplified OData-like filtering)
   */
  private applyFilter(
    results: Array<{
      doc: DebtorSearchDocument;
      score: number;
      highlights: Record<string, string[]>;
    }>,
    filter: string,
  ): Array<{ doc: DebtorSearchDocument; score: number; highlights: Record<string, string[]> }> {
    // Simple filter parsing - supports "field eq 'value'" format
    const filterParts = filter.match(/(\w+)\s+(eq|ne)\s+'([^']+)'/);
    if (!filterParts) return results;

    const [, field, operator, value] = filterParts;
    const valueLower = value.toLowerCase();

    return results.filter((r) => {
      const fieldValue = (r.doc as Record<string, unknown>)[field] as string | undefined;
      const fieldValueLower = fieldValue?.toLowerCase();
      if (!fieldValueLower) return operator === 'ne';

      if (operator === 'eq') {
        return fieldValueLower === valueLower;
      } else if (operator === 'ne') {
        return fieldValueLower !== valueLower;
      }
      return true;
    });
  }

  /**
   * Calculates facets for the given fields
   */
  private calculateFacets(
    results: Array<{
      doc: DebtorSearchDocument;
      score: number;
      highlights: Record<string, string[]>;
    }>,
    facetFields: string[],
  ): Record<string, FacetResult[]> {
    const facets: Record<string, FacetResult[]> = {};

    facetFields.forEach((field) => {
      const counts: Record<string, number> = {};

      results.forEach((r) => {
        const value = (r.doc as Record<string, unknown>)[field] as string | undefined;
        if (value) {
          counts[value] = (counts[value] || 0) + 1;
        }
      });

      // Convert to FacetResult array and sort by count
      facets[field] = Object.entries(counts)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    });

    return facets;
  }

  /**
   * Selects only specified fields from a document
   */
  private selectFields(
    doc: DebtorSearchDocument,
    fields?: string[],
  ): Partial<DebtorSearchDocument> {
    if (!fields || fields.length === 0) {
      return { ...doc };
    }

    const selected: Partial<DebtorSearchDocument> = {};
    fields.forEach((field) => {
      const key = field as keyof DebtorSearchDocument;
      if (key in doc) {
        selected[key] = doc[key];
      }
    });
    return selected;
  }
}
