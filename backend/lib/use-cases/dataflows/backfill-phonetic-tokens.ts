import { SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import QueryBuilder from '../../query/query-builder';
import { generateSearchTokens } from '../../adapters/utils/phonetic-helper';
import { MaybeData } from './queue-types';
import { PhoneticBackfillState } from '../gateways.types';

const MODULE_NAME = 'BACKFILL-PHONETIC-TOKENS-USE-CASE';

const { and, or, using } = QueryBuilder;

// Type augmentation for MongoDB queries - allows dot-notation paths
// _id is MongoDB's ObjectId field which is time-ordered (contains timestamp)
type SyncedCaseQueryable = SyncedCase & {
  'debtor.phoneticTokens'?: string[];
  _id: string; // MongoDB ObjectId as string - time-ordered for safe cursor pagination
};

/**
 * Builds the query to find SYNCED_CASE documents that need phonetic token backfill.
 * A case needs backfill if debtor.phoneticTokens is missing or empty.
 *
 * Uses MongoDB's _id (ObjectId) for cursor-based pagination because ObjectIds are
 * time-ordered (first 4 bytes are timestamp), ensuring new documents always have
 * larger _id values than existing ones. This prevents skipping documents during migration.
 *
 * @param lastId - Optional cursor position (_id as string); if provided, only returns documents with _id > lastId
 */
function buildNeedsBackfillQuery(lastId?: string | null) {
  const doc = using<SyncedCaseQueryable>();
  const conditions = [
    doc('documentType').equals('SYNCED_CASE'),
    or(doc('debtor.phoneticTokens').notExists(), doc('debtor.phoneticTokens').equals([])),
  ];

  if (lastId) {
    conditions.push(doc('_id').greaterThan(lastId));
  }

  return and(...conditions);
}

export type BackfillCase = {
  _id: string; // MongoDB ObjectId as string - used for cursor pagination
  caseId: string;
  debtor?: {
    name?: string;
  };
  jointDebtor?: {
    name?: string;
  };
};

type CursorPageResult = {
  cases: BackfillCase[];
  lastId: string | null;
  hasMore: boolean;
};

type CursorPageMaybeResult = MaybeData<CursorPageResult>;

/**
 * Gets a page of cases that need phonetic token backfill using cursor-based pagination.
 *
 * PAGINATION STRATEGY: Uses _id > lastId cursor-based pagination which is efficient
 * for large datasets because it uses the index directly without skip/offset overhead.
 *
 * Uses MongoDB's _id (ObjectId) because ObjectIds are time-ordered - they contain a
 * timestamp in the first 4 bytes. This ensures new documents inserted during migration
 * will always have larger _id values, preventing any documents from being skipped.
 *
 * The method fetches limit + 1 records to detect if more results exist.
 *
 * @param context - Application context
 * @param lastId - Cursor position (_id as string, null for first page)
 * @param limit - Number of cases to fetch per page
 * @returns Cases that need backfill, the new cursor position, and hasMore flag
 */
async function getPageOfCasesNeedingBackfillByCursor(
  context: ApplicationContext,
  lastId: string | null,
  limit: number,
): Promise<CursorPageMaybeResult> {
  try {
    const repo = factory.getCasesRepository(context);
    const query = buildNeedsBackfillQuery(lastId);

    // Fetch limit + 1 to detect if there are more results
    // Sort by _id (ObjectId) which is time-ordered for safe cursor pagination
    const results = await repo.findByCursor<SyncedCaseQueryable>(query, {
      limit: limit + 1,
      sortField: '_id',
      sortDirection: 'ASCENDING',
    });

    const hasMore = results.length > limit;
    const cases = results.slice(0, limit);
    const newLastId = cases.length > 0 ? cases[cases.length - 1]._id : null;

    return {
      data: {
        cases: cases.map((c) => ({
          _id: c._id,
          caseId: c.caseId,
          debtor: c.debtor ? { name: c.debtor.name } : undefined,
          jointDebtor: c.jointDebtor ? { name: c.jointDebtor.name } : undefined,
        })),
        lastId: newLastId,
        hasMore,
      },
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of cases needing backfill by cursor (lastId: ${lastId}, limit: ${limit}).`,
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
 * Reads the current backfill state from the runtime-state collection.
 * Returns null if no state exists (first run).
 */
async function readBackfillState(
  context: ApplicationContext,
): Promise<MaybeData<PhoneticBackfillState | null>> {
  try {
    const repo = factory.getPhoneticBackfillStateRepo(context);
    const state = await repo.read('PHONETIC_BACKFILL_STATE');
    return { data: state };
  } catch (originalError) {
    // NotFoundError is expected on first run
    if (isNotFoundError(originalError)) {
      return { data: null };
    }
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to read backfill state.'),
    };
  }
}

/**
 * Updates the backfill state in the runtime-state collection.
 * Uses upsert to create if not exists or update if exists.
 */
async function updateBackfillState(
  context: ApplicationContext,
  updates: Partial<Omit<PhoneticBackfillState, 'documentType'>> & {
    lastId: string | null;
    processedCount: number;
    status: PhoneticBackfillState['status'];
  },
): Promise<MaybeData<PhoneticBackfillState>> {
  try {
    const repo = factory.getPhoneticBackfillStateRepo(context);
    const now = new Date().toISOString();

    // Read existing state to preserve startedAt if it exists
    let existingState: PhoneticBackfillState | null = null;
    try {
      existingState = await repo.read('PHONETIC_BACKFILL_STATE');
    } catch (originalError) {
      // NotFoundError is expected on first run, rethrow other errors
      if (!isNotFoundError(originalError)) {
        throw originalError;
      }
    }

    const state: PhoneticBackfillState = {
      id: existingState?.id,
      documentType: 'PHONETIC_BACKFILL_STATE',
      lastId: updates.lastId,
      processedCount: updates.processedCount,
      startedAt: existingState?.startedAt ?? now,
      lastUpdatedAt: now,
      status: updates.status,
    };

    const result = await repo.upsert(state);
    return { data: result };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to update backfill state.'),
    };
  }
}

const BackfillPhoneticTokens = {
  getPageOfCasesNeedingBackfillByCursor,
  backfillTokensForCases,
  readBackfillState,
  updateBackfillState,
  generateTokenUpdates,
};

export default BackfillPhoneticTokens;
