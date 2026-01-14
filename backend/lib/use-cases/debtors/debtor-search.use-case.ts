import { ApplicationContext } from '../../adapters/types/basic';
import { SearchGateway } from '../gateways.types';
import { DebtorSearchDocument, SearchResult } from '../../adapters/types/search';
import { getSearchGateway } from '../../factory';
import { CamsError } from '../../common-errors/cams-error';
import { UnknownError } from '../../common-errors/unknown-error';

const MODULE_NAME = 'DEBTOR-SEARCH-USE-CASE';

export interface DebtorSearchOptions {
  searchText: string;
  fuzzy?: boolean;
  top?: number;
  skip?: number;
  fields?: string[];
}

export interface DebtorSearchResponse {
  results: DebtorSearchDocument[];
  totalCount: number;
  searchText: string;
  fuzzy: boolean;
}

/**
 * Use case for searching bankruptcy debtor records
 */
export class DebtorSearchUseCase {
  private searchGateway: SearchGateway;

  constructor(context: ApplicationContext) {
    this.searchGateway = getSearchGateway(context);
  }

  /**
   * Search for debtors by name or other criteria
   */
  async searchDebtors(
    context: ApplicationContext,
    options: DebtorSearchOptions,
  ): Promise<DebtorSearchResponse> {
    const { searchText, fuzzy = false, top = 25, skip = 0, fields } = options;

    context.logger?.info(MODULE_NAME, 'Searching debtors', {
      searchText,
      fuzzy,
      top,
      skip,
    });

    try {
      // Validate search parameters
      if (!searchText || searchText.trim().length === 0) {
        throw new CamsError(MODULE_NAME, {
          status: 400,
          message: 'Search text is required',
        });
      }

      if (searchText.length < 2) {
        throw new CamsError(MODULE_NAME, {
          status: 400,
          message: 'Search text must be at least 2 characters',
        });
      }

      // Perform the search
      const searchResult: SearchResult<DebtorSearchDocument> = await this.searchGateway.search(
        searchText.trim(),
        {
          fuzzy,
          top,
          skip,
          select: fields,
        },
      );

      context.logger?.info(MODULE_NAME, 'Search completed', {
        resultsFound: searchResult.count,
        resultsReturned: searchResult.results.length,
      });

      return {
        results: searchResult.results,
        totalCount: searchResult.count,
        searchText: searchText.trim(),
        fuzzy,
      };
    } catch (error) {
      context.logger?.error(MODULE_NAME, 'Error searching debtors', error);

      if (error instanceof CamsError) {
        throw error;
      }

      throw new UnknownError(MODULE_NAME, {
        message: 'Failed to search debtors',
        originalError: error,
      });
    }
  }

  /**
   * Get a single debtor by ID
   * Note: This is a placeholder for future implementation
   */
  async getDebtorById(
    context: ApplicationContext,
    debtorId: string,
  ): Promise<DebtorSearchDocument | null> {
    context.logger?.info(MODULE_NAME, 'Getting debtor by ID', { debtorId });

    // TODO: Implement direct lookup by ID
    // For now, this is a placeholder that would need to integrate
    // with the actual debtor data source (Cosmos DB)

    throw new CamsError(MODULE_NAME, {
      status: 501,
      message: 'Get debtor by ID not yet implemented',
    });
  }

  /**
   * Initialize or recreate the search index
   * This should only be called during setup or maintenance
   */
  async initializeSearchIndex(context: ApplicationContext): Promise<void> {
    context.logger?.info(MODULE_NAME, 'Initializing search index');

    try {
      // Create or recreate the index
      await this.searchGateway.createIndex();

      context.logger?.info(MODULE_NAME, 'Search index initialized successfully');
    } catch (error) {
      context.logger?.error(MODULE_NAME, 'Error initializing search index', error);

      throw new UnknownError(MODULE_NAME, {
        message: 'Failed to initialize search index',
        originalError: error,
      });
    }
  }

  /**
   * Sync debtor data from source database to search index
   * This would be called by a scheduled job or triggered by changes
   */
  async syncDebtorData(
    context: ApplicationContext,
    debtors: DebtorSearchDocument[],
  ): Promise<void> {
    context.logger?.info(MODULE_NAME, 'Syncing debtor data to search index', {
      debtorCount: debtors.length,
    });

    try {
      if (debtors.length === 0) {
        context.logger?.warn(MODULE_NAME, 'No debtors to sync');
        return;
      }

      // Upload documents in batches (Azure Search has a limit of 1000 per batch)
      const batchSize = 1000;
      for (let i = 0; i < debtors.length; i += batchSize) {
        const batch = debtors.slice(i, i + batchSize);
        await this.searchGateway.uploadDocuments(batch);

        context.logger?.info(MODULE_NAME, 'Uploaded batch to search index', {
          batchNumber: Math.floor(i / batchSize) + 1,
          documentsInBatch: batch.length,
        });
      }

      context.logger?.info(MODULE_NAME, 'Debtor data sync completed successfully');
    } catch (error) {
      context.logger?.error(MODULE_NAME, 'Error syncing debtor data', error);

      throw new UnknownError(MODULE_NAME, {
        message: 'Failed to sync debtor data to search index',
        originalError: error,
      });
    }
  }

  /**
   * Get statistics about the search index
   */
  async getIndexStats(context: ApplicationContext): Promise<{ documentCount: number }> {
    context.logger?.info(MODULE_NAME, 'Getting search index statistics');

    try {
      const documentCount = await this.searchGateway.getDocumentCount();

      return {
        documentCount,
      };
    } catch (error) {
      context.logger?.error(MODULE_NAME, 'Error getting index statistics', error);

      throw new UnknownError(MODULE_NAME, {
        message: 'Failed to get search index statistics',
        originalError: error,
      });
    }
  }
}
