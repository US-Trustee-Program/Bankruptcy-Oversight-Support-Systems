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
 * Generic search result with pagination metadata
 */
export interface SearchResult<T> {
  results: T[];
  count: number;
  facets?: Record<string, unknown>;
}

/**
 * Search options for controlling query behavior
 */
export interface SearchOptions {
  fuzzy?: boolean;
  top?: number;
  skip?: number;
  select?: string[];
}
