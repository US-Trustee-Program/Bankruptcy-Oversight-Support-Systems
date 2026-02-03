import { SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import QueryBuilder from '../../query/query-builder';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import { MaybeData, MaybeVoid } from './queue-types';

const MODULE_NAME = 'BACKFILL-PHONETIC-TOKENS-USE-CASE';

const { and, or, using } = QueryBuilder;

// Type augmentation for MongoDB queries - allows dot-notation paths
type SyncedCaseQueryable = SyncedCase & {
  'debtor.phoneticTokens'?: string[];
};

/**
 * Builds the query to find SYNCED_CASE documents that need phonetic token backfill.
 * A case needs backfill if debtor.phoneticTokens is missing or empty.
 *
 * This query is used both for counting and paginating to ensure consistency.
 */
function buildNeedsBackfillQuery() {
  const doc = using<SyncedCaseQueryable>();
  return and(
    doc('documentType').equals('SYNCED_CASE'),
    or(doc('debtor.phoneticTokens').notExists(), doc('debtor.phoneticTokens').equals([])),
  );
}

export type BackfillCase = {
  caseId: string;
  debtor?: {
    name?: string;
  };
  jointDebtor?: {
    name?: string;
  };
};

type BackfillPageResult = MaybeData<BackfillCase[]>;

/**
 * Gets a page of cases that need phonetic token backfill.
 *
 * PAGINATION STRATEGY: Uses database-level filtering with buildNeedsBackfillQuery()
 * to paginate only over cases that need backfill. This is more efficient than
 * fetching all cases and filtering in memory.
 *
 * The same query is used in countCasesNeedingBackfill() to ensure page ranges
 * align correctly with the filtered dataset.
 *
 * @param offset - Starting position in the filtered set (cases needing backfill only)
 * @param limit - Number of cases to fetch
 * @returns Cases that need backfill from this page
 */
async function getPageOfCasesNeedingBackfill(
  context: ApplicationContext,
  offset: number,
  limit: number,
): Promise<BackfillPageResult> {
  try {
    const repo = factory.getCasesRepository(context);
    const query = buildNeedsBackfillQuery();
    const result = await repo.searchByQuery<SyncedCaseQueryable>(query, { limit, offset });

    return {
      data: result.data.map((c) => ({
        caseId: c.caseId,
        debtor: c.debtor ? { name: c.debtor.name } : undefined,
        jointDebtor: c.jointDebtor ? { name: c.jointDebtor.name } : undefined,
      })),
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of cases needing backfill (offset: ${offset}, limit: ${limit}).`,
      ),
    };
  }
}

/**
 * Generates phonetic tokens for a case's debtor and joint debtor names.
 * Returns MongoDB update operations to set the phoneticTokens fields.
 */
function generateTokenUpdates(bCase: BackfillCase): Record<string, string[]> {
  const updates: Record<string, string[]> = {};

  if (bCase.debtor?.name) {
    updates['debtor.phoneticTokens'] = generateSearchTokens(bCase.debtor.name);
  }

  if (bCase.jointDebtor?.name) {
    updates['jointDebtor.phoneticTokens'] = generateSearchTokens(bCase.jointDebtor.name);
  }

  return updates;
}

type BackfillResult = {
  caseId: string;
  success: boolean;
  error?: string;
};

/**
 * Backfills phonetic tokens for a batch of cases.
 * Updates each case's debtor.phoneticTokens and jointDebtor.phoneticTokens fields.
 */
async function backfillTokensForCases(
  context: ApplicationContext,
  cases: BackfillCase[],
): Promise<MaybeData<BackfillResult[]>> {
  const results: BackfillResult[] = [];

  try {
    const repo = factory.getCasesRepository(context);
    const doc = using<SyncedCase>();

    for (const bCase of cases) {
      try {
        const tokenUpdates = generateTokenUpdates(bCase);

        if (Object.keys(tokenUpdates).length === 0) {
          results.push({
            caseId: bCase.caseId,
            success: true,
          });
          continue;
        }

        const query = and(
          doc('caseId').equals(bCase.caseId),
          doc('documentType').equals('SYNCED_CASE'),
        );

        await repo.updateManyByQuery(query, { $set: tokenUpdates });

        results.push({
          caseId: bCase.caseId,
          success: true,
        });
      } catch (originalError) {
        results.push({
          caseId: bCase.caseId,
          success: false,
          error: originalError instanceof Error ? originalError.message : String(originalError),
        });
      }
    }

    return { data: results };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to backfill tokens for cases.'),
    };
  }
}

/**
 * Counts the number of SYNCED_CASE documents that need phonetic token backfill.
 * Uses the same query as getPageOfCasesNeedingBackfill() to ensure consistency.
 *
 * This pushes the filtering to the database level for efficiency.
 */
async function countCasesNeedingBackfill(context: ApplicationContext): Promise<MaybeData<number>> {
  try {
    const repo = factory.getCasesRepository(context);
    const query = buildNeedsBackfillQuery();
    const count = await repo.countByQuery(query);
    return { data: count };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to count cases needing phonetic token backfill.',
      ),
    };
  }
}

/**
 * Initializes the backfill by returning the count of cases needing backfill.
 * Used by the START queue handler to create page ranges.
 *
 * Uses database-level filtering (buildNeedsBackfillQuery) to count only cases
 * that actually need backfill, matching the pagination strategy in getPageOfCasesNeedingBackfill.
 */
async function initializeBackfill(context: ApplicationContext): Promise<MaybeData<number>> {
  return countCasesNeedingBackfill(context);
}

/**
 * Marks backfill as complete. Currently a no-op but could be extended
 * to store completion state if needed.
 */
async function completeBackfill(_context: ApplicationContext): Promise<MaybeVoid> {
  return { success: true };
}

const BackfillPhoneticTokens = {
  getPageOfCasesNeedingBackfill,
  backfillTokensForCases,
  countCasesNeedingBackfill,
  initializeBackfill,
  completeBackfill,
  generateTokenUpdates,
};

export default BackfillPhoneticTokens;
