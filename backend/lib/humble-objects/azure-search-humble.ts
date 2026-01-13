import {
  SearchClient,
  SearchIndexClient,
  AzureKeyCredential,
  SearchIndex,
  SearchIndexerDataContainer,
  IndexDocumentsResult,
} from '@azure/search-documents';
import { AzureSearchConfig, DebtorSearchDocument } from '../adapters/types/search';

/**
 * Humble object wrapper for Azure Search SDK
 * Handles SDK interactions and error serialization
 */
export class AzureSearchHumble {
  private indexClient: SearchIndexClient;
  private searchClient: SearchClient<DebtorSearchDocument>;
  private config: AzureSearchConfig;

  constructor(config: AzureSearchConfig) {
    this.config = config;
    const credential = new AzureKeyCredential(config.apiKey);

    this.indexClient = new SearchIndexClient(config.endpoint, credential);
    this.searchClient = new SearchClient<DebtorSearchDocument>(
      config.endpoint,
      config.indexName,
      credential,
    );
  }

  /**
   * Creates a search index with the given definition
   */
  async createIndex(indexDefinition: SearchIndex): Promise<void> {
    try {
      await this.indexClient.createIndex(indexDefinition);
    } catch (originalError) {
      throw this.buildSerializableError(originalError);
    }
  }

  /**
   * Deletes the search index
   */
  async deleteIndex(): Promise<void> {
    try {
      await this.indexClient.deleteIndex(this.config.indexName);
    } catch (originalError) {
      throw this.buildSerializableError(originalError);
    }
  }

  /**
   * Checks if the index exists
   */
  async indexExists(): Promise<boolean> {
    try {
      await this.indexClient.getIndex(this.config.indexName);
      return true;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return false;
      }
      throw this.buildSerializableError(error);
    }
  }

  /**
   * Uploads documents to the search index
   */
  async uploadDocuments(documents: DebtorSearchDocument[]): Promise<IndexDocumentsResult> {
    try {
      return await this.searchClient.uploadDocuments(documents);
    } catch (originalError) {
      throw this.buildSerializableError(originalError);
    }
  }

  /**
   * Searches the index
   */
  async search(searchText: string, options: any): Promise<any> {
    try {
      return await this.searchClient.search(searchText, options);
    } catch (originalError) {
      throw this.buildSerializableError(originalError);
    }
  }

  /**
   * Gets the total document count in the index
   */
  async getDocumentCount(): Promise<number> {
    try {
      const result = await this.searchClient.search('*', {
        includeTotalCount: true,
        top: 0,
      });

      return result.count || 0;
    } catch (originalError) {
      throw this.buildSerializableError(originalError);
    }
  }

  /**
   * Checks if an error is a 404 Not Found error
   */
  private isNotFoundError(error: unknown): boolean {
    if (typeof error === 'object' && error !== null) {
      const statusCode = (error as any).statusCode || (error as any).status;
      return statusCode === 404;
    }
    return false;
  }

  /**
   * Builds a serializable error from Azure SDK errors
   * Azure SDK errors may contain non-serializable properties
   */
  private buildSerializableError(originalError: unknown): Error {
    if (originalError instanceof Error) {
      const serializedError = new Error(originalError.message);
      serializedError.name = originalError.name;
      serializedError.stack = originalError.stack;

      // Copy over any additional serializable properties
      const errorObj = originalError as any;
      if (errorObj.statusCode) {
        (serializedError as any).statusCode = errorObj.statusCode;
      }
      if (errorObj.code) {
        (serializedError as any).code = errorObj.code;
      }
      if (errorObj.details) {
        (serializedError as any).details = errorObj.details;
      }

      return serializedError;
    }

    return new Error(String(originalError));
  }
}
