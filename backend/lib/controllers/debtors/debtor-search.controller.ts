import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import {
  DebtorSearchUseCase,
  DebtorSearchResponse,
} from '../../use-cases/debtors/debtor-search.use-case';
import { SuggestionResult } from '../../adapters/types/search';

const MODULE_NAME = 'DEBTOR-SEARCH-CONTROLLER';

/**
 * Controller for handling debtor search requests
 */
export class DebtorSearchController implements CamsController {
  private readonly useCase: DebtorSearchUseCase;

  constructor(applicationContext: ApplicationContext) {
    this.useCase = new DebtorSearchUseCase(applicationContext);
  }

  /**
   * Handle debtor search requests
   *
   * Query parameters:
   * - q: Search text (required)
   * - fuzzy: Enable fuzzy matching (optional, default: false)
   * - top: Number of results to return (optional, default: 25)
   * - skip: Number of results to skip for pagination (optional, default: 0)
   * - fields: Comma-separated list of fields to return (optional)
   * - highlight: Comma-separated list of fields to highlight (optional)
   * - facets: Comma-separated list of fields to generate facets for (optional)
   * - filter: OData-style filter expression (optional, e.g., "state eq 'CA'")
   */
  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<DebtorSearchResponse>> {
    try {
      const query = context.request?.query || {};

      // Parse query parameters
      const searchText = query.q || query.search || '';
      const fuzzy = query.fuzzy === 'true' || query.fuzzy === '1';
      const top = parseInt(query.top || '25', 10);
      const skip = parseInt(query.skip || '0', 10);
      const fields = query.fields
        ? query.fields.split(',').map((f: string) => f.trim())
        : undefined;
      const highlight = query.highlight
        ? query.highlight.split(',').map((f: string) => f.trim())
        : undefined;
      const facets = query.facets
        ? query.facets.split(',').map((f: string) => f.trim())
        : undefined;
      const filter = query.filter || undefined;

      // Perform the search
      const searchResult = await this.useCase.searchDebtors(context, {
        searchText,
        fuzzy,
        top,
        skip,
        fields,
        highlight,
        facets,
        filter,
      });

      // Build response with pagination metadata
      const response = httpSuccess({
        body: {
          meta: {
            self: context.request!.url,
            count: searchResult.results.length,
            total: searchResult.totalCount,
            pagination: {
              skip,
              top,
              hasNext: skip + searchResult.results.length < searchResult.totalCount,
              hasPrevious: skip > 0,
            },
          },
          data: searchResult,
        },
      });

      return response;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  /**
   * Handle request to get index statistics
   */
  public async handleStatsRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<{ documentCount: number }>> {
    try {
      const stats = await this.useCase.getIndexStats(context);

      const response = httpSuccess({
        body: {
          meta: {
            self: context.request!.url,
          },
          data: stats,
        },
      });

      return response;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  /**
   * Handle admin request to initialize search index
   * This should be restricted to admin users only
   */
  public async handleInitializeIndexRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<{ success: boolean; message: string }>> {
    try {
      // TODO: Add admin authorization check here

      await this.useCase.initializeSearchIndex(context);

      const response = httpSuccess({
        body: {
          meta: {
            self: context.request!.url,
          },
          data: {
            success: true,
            message: 'Search index initialized successfully',
          },
        },
      });

      return response;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  /**
   * Handle admin request to sync debtor data
   * This should be restricted to admin users only
   */
  public async handleSyncDataRequest(
    context: ApplicationContext,
  ): Promise<
    CamsHttpResponseInit<{ success: boolean; message: string; documentsProcessed: number }>
  > {
    try {
      // TODO: Add admin authorization check here

      const debtorDocuments = context.request?.body?.documents || [];

      if (!Array.isArray(debtorDocuments)) {
        throw new Error('Invalid request body: documents must be an array');
      }

      await this.useCase.syncDebtorData(context, debtorDocuments);

      const response = httpSuccess({
        body: {
          meta: {
            self: context.request!.url,
          },
          data: {
            success: true,
            message: 'Debtor data synced successfully',
            documentsProcessed: debtorDocuments.length,
          },
        },
      });

      return response;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  /**
   * Handle autocomplete suggestions request
   *
   * Query parameters:
   * - q: Partial search text (required, minimum 2 characters)
   * - top: Number of suggestions to return (optional, default: 10)
   */
  public async handleSuggestRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit<{ suggestions: SuggestionResult[] }>> {
    try {
      const query = context.request?.query || {};

      // Parse query parameters
      const searchText = query.q || '';
      const top = parseInt(query.top || '10', 10);

      // Get suggestions
      const suggestions = await this.useCase.getSuggestions(context, {
        searchText,
        top,
      });

      const response = httpSuccess({
        body: {
          meta: {
            self: context.request!.url,
            count: suggestions.length,
          },
          data: {
            suggestions,
          },
        },
      });

      return response;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
