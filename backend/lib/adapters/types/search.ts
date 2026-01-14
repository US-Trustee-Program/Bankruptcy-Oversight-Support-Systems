/**
 * Azure AI Search configuration
 */
export interface AzureSearchConfig {
  endpoint: string;
  apiKey: string;
  indexName: string;
  mock: boolean;
}

/**
 * Debtor document structure for Azure Search index
 */
export interface DebtorSearchDocument {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  ssn?: string;
  taxId?: string;
  address?: string;
  city?: string;
  state?: string;
}

/**
 * Search result item with highlighting and scoring
 */
export interface SearchResultItem<T> {
  document: T;
  score: number;
  highlights?: Record<string, string[]>;
}

/**
 * Facet result showing counts for each value
 */
export interface FacetResult {
  value: string;
  count: number;
}

/**
 * Generic search result with pagination metadata
 */
export interface SearchResult<T> {
  results: T[];
  count: number;
  facets?: Record<string, FacetResult[]>;
  // For enhanced results with scoring/highlighting
  items?: SearchResultItem<T>[];
}

/**
 * Search options for controlling query behavior
 */
export interface SearchOptions {
  fuzzy?: boolean;
  top?: number;
  skip?: number;
  select?: string[];
  // New options for advanced features
  facets?: string[];
  highlight?: string[];
  filter?: string;
  orderBy?: string;
  includeTotalCount?: boolean;
  searchMode?: 'any' | 'all';
}

/**
 * Autocomplete/Suggestion result
 */
export interface SuggestionResult {
  text: string;
  highlightedText?: string;
}
