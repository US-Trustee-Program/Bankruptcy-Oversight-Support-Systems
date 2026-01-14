import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import {
  DebtorSearchUseCase,
  DebtorSearchResponse,
} from '../../use-cases/debtors/debtor-search.use-case';

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

      // Perform the search
      const searchResult = await this.useCase.searchDebtors(context, {
        searchText,
        fuzzy,
        top,
        skip,
        fields,
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
}
