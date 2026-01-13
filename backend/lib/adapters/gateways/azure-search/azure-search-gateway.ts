import { SearchGateway } from '../../../use-cases/gateways.types';
import { AzureSearchHumble } from '../../../humble-objects/azure-search-humble';
import {
  AzureSearchConfig,
  DebtorSearchDocument,
  SearchResult,
  SearchOptions,
} from '../../types/search';
import { SearchIndex } from '@azure/search-documents';

const MODULE_NAME = 'AZURE_SEARCH_GATEWAY';

/**
 * Azure AI Search gateway implementation
 * Provides search capabilities for debtor records
 */
export class AzureSearchGateway implements SearchGateway {
  private humble: AzureSearchHumble;
  private config: AzureSearchConfig;

  constructor(config: AzureSearchConfig) {
    this.config = config;
    this.humble = new AzureSearchHumble(config);
  }

  /**
   * Creates the bankruptcy debtors search index
   */
  async createIndex(): Promise<void> {
    // Check if index already exists
    const exists = await this.humble.indexExists();
    if (exists) {
      console.log(`Index "${this.config.indexName}" already exists, skipping creation.`);
      return;
    }

    const indexDefinition: SearchIndex = {
      name: this.config.indexName,
      fields: [
        {
          name: 'id',
          type: 'Edm.String',
          key: true,
          filterable: true,
        },
        {
          name: 'name',
          type: 'Edm.String',
          searchable: true,
          filterable: true,
          sortable: true,
        },
        {
          name: 'firstName',
          type: 'Edm.String',
          searchable: true,
          filterable: false,
        },
        {
          name: 'lastName',
          type: 'Edm.String',
          searchable: true,
          filterable: false,
        },
        {
          name: 'ssn',
          type: 'Edm.String',
          searchable: false, // PII: not searchable, only filterable for exact match
          filterable: true,
        },
        {
          name: 'taxId',
          type: 'Edm.String',
          searchable: false, // PII: not searchable, only filterable for exact match
          filterable: true,
        },
        {
          name: 'address',
          type: 'Edm.String',
          searchable: true,
          filterable: false,
        },
        {
          name: 'city',
          type: 'Edm.String',
          searchable: false,
          filterable: true,
          facetable: true,
        },
        {
          name: 'state',
          type: 'Edm.String',
          searchable: false,
          filterable: true,
          facetable: true,
        },
      ],
    };

    await this.humble.createIndex(indexDefinition);
  }

  /**
   * Deletes the search index
   */
  async deleteIndex(): Promise<void> {
    await this.humble.deleteIndex();
  }

  /**
   * Uploads documents to the search index
   * Handles batching for large document sets
   */
  async uploadDocuments<T>(documents: T[]): Promise<void> {
    const batchSize = 1000; // Azure Search recommended batch size

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize) as DebtorSearchDocument[];
      const result = await this.humble.uploadDocuments(batch);

      // Log any failures
      if (result.results.some((r) => !r.succeeded)) {
        const failures = result.results.filter((r) => !r.succeeded);
        console.error(`Failed to upload ${failures.length} documents:`, failures);
      }
    }
  }

  /**
   * Searches the index for documents matching the search text
   * Supports fuzzy matching with configurable edit distance
   */
  async search<T>(searchText: string, options?: SearchOptions): Promise<SearchResult<T>> {
    // Build fuzzy query if requested
    let queryText = searchText;
    if (options?.fuzzy) {
      // Add fuzzy operator with edit distance 1
      // For multi-word queries, apply fuzzy to each word
      const words = searchText.split(' ').filter((w) => w.length > 0);
      queryText = words.map((word) => `${word}~1`).join(' ');
    }

    const searchOptions = {
      queryType: 'full' as const, // Use full Lucene syntax
      searchMode: 'any' as const, // Match any search term
      top: options?.top || 25,
      skip: options?.skip || 0,
      select: options?.select,
      includeTotalCount: true,
    };

    const results = await this.humble.search(queryText, searchOptions);

    // Convert AsyncIterableIterator to array
    const documents: T[] = [];
    for await (const result of results.results) {
      documents.push(result.document as T);
    }

    return {
      results: documents,
      count: results.count || 0,
    };
  }

  /**
   * Gets the total number of documents in the index
   */
  async getDocumentCount(): Promise<number> {
    return await this.humble.getDocumentCount();
  }

  /**
   * Releases resources (required by Releasable interface)
   */
  async release(): Promise<void> {
    // No cleanup needed for Azure Search client
  }
}
