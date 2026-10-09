import { SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import QueryBuilder from '../../query/query-builder';
import { MaybeData } from './queue-types';
import { UstDivisionCodeBackfillState } from '../gateways.types';

const MODULE_NAME = 'BACKFILL-UST-DIVISION-CODE-USE-CASE';

const { and, using } = QueryBuilder;

// Scoped to Eastern District of TN (court 0649) only — this is the only district where bare
// CS_DIV and CS_DIV_ACMS diverge that CAMS-936 addresses; see bead for the nationwide follow-up.
const EASTERN_DISTRICT_TN_COURT_ID = '0649';

type SyncedCaseQueryable = SyncedCase & { _id: string };

export type BackfillCase = {
  _id: string;
  caseId: string;
};

type CursorPageResult = {
  cases: BackfillCase[];
  lastId: string | null;
  hasMore: boolean;
};

type CursorPageMaybeResult = MaybeData<CursorPageResult>;

/**
 * Gets a page of Eastern-District-of-TN SYNCED_CASE documents missing ustDivisionCode,
 * using cursor-based pagination on _id for resumability.
 */
async function getPageOfCasesNeedingBackfillByCursor(
  context: ApplicationContext,
  lastId: string | null,
  limit: number,
): Promise<CursorPageMaybeResult> {
  try {
    const repo = factory.getCasesRepository(context);
    const doc = using<SyncedCaseQueryable>();
    const conditions = [
      doc('documentType').equals('SYNCED_CASE'),
      doc('courtId').equals(EASTERN_DISTRICT_TN_COURT_ID),
      doc('ustDivisionCode').notExists(),
    ];
    if (lastId) conditions.push(doc('_id').greaterThan(lastId));
    const query = and(...conditions);

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
        cases: cases.map((c) => ({ _id: c._id, caseId: c.caseId })),
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

type BackfillResult = {
  caseId: string;
  success: boolean;
  error?: string;
};

type ProcessBackfillPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | {
      status: 'ok';
      processedCount: number;
      successCount: number;
      failedResults: BackfillResult[];
      cases: BackfillCase[];
      nextCursor: { lastId: string | null } | null;
    };

/**
 * Backfills ustDivisionCode for a batch of cases. Re-fetches bare CS_DIV from DXTR in a
 * single batch query (case identity/caseId does not change) and writes it to CosmosDB.
 * Skips cases DXTR no longer reports — does not fail the batch.
 */
async function backfillUstDivisionCodes(
  context: ApplicationContext,
  cases: BackfillCase[],
): Promise<MaybeData<BackfillResult[]>> {
  const results: BackfillResult[] = [];

  try {
    const dxtrGateway = factory.getCasesGateway(context);
    const casesRepo = factory.getCasesRepository(context);
    const doc = using<SyncedCase>();

    const caseIds = cases.map((c) => c.caseId);
    const ustDivisionCodeMap = await dxtrGateway.getUstDivisionCodesByCaseIds(context, caseIds);

    let skippedNotInDxtr = 0;

    for (const bCase of cases) {
      try {
        const ustDivisionCode = ustDivisionCodeMap.get(bCase.caseId);

        if (!ustDivisionCode) {
          skippedNotInDxtr++;
          context.logger.debug(
            MODULE_NAME,
            `No DXTR CS_DIV found for case ${bCase.caseId} — skipping.`,
          );
          results.push({ caseId: bCase.caseId, success: true });
          continue;
        }

        const query = and(
          doc('caseId').equals(bCase.caseId),
          doc('documentType').equals('SYNCED_CASE'),
        );
        await casesRepo.updateManyByQuery(query, { $set: { ustDivisionCode } });

        results.push({ caseId: bCase.caseId, success: true });
      } catch (originalError) {
        results.push({
          caseId: bCase.caseId,
          success: false,
          error: originalError instanceof Error ? originalError.message : String(originalError),
        });
      }
    }

    if (skippedNotInDxtr > 0) {
      context.logger.info(
        MODULE_NAME,
        `Skipped ${skippedNotInDxtr} cases with no DXTR CS_DIV match.`,
      );
    }
    return { data: results };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to backfill ustDivisionCode for batch.',
      ),
    };
  }
}

/**
 * Coordinates a single backfill page: reads state, fetches the page, backfills codes,
 * and updates state. Returns a discriminated result the handler uses for queue I/O.
 */
async function processBackfillPage(
  context: ApplicationContext,
  cursorLastId: string | null,
  pageSize: number,
): Promise<ProcessBackfillPageResult> {
  const stateResult = await readBackfillState(context);
  if (stateResult.error) return { status: 'error', error: stateResult.error as CamsError };

  const existingState = stateResult.data;
  const currentProcessedCount = existingState?.processedCount ?? 0;

  const pageResult = await getPageOfCasesNeedingBackfillByCursor(context, cursorLastId, pageSize);
  if (pageResult.error || !pageResult.data) {
    // MaybeData's data/error fields are both optional (not a strict discriminated union), so
    // this fallback guards a state getPageOfCasesNeedingBackfillByCursor's own contract should
    // never produce (one of the two always set) — same defensive convention used by sibling
    // backfill use-cases (e.g. backfill-case-appointment-dates.ts).
    return {
      status: 'error',
      error:
        (pageResult.error as CamsError) ??
        getCamsError(new Error('Unexpected missing data in page result'), MODULE_NAME),
    };
  }

  const { cases, lastId: newLastId, hasMore } = pageResult.data;

  if (cases.length === 0) {
    const updateResult = await updateBackfillState(
      context,
      { lastId: cursorLastId, processedCount: currentProcessedCount, status: 'COMPLETED' },
      existingState,
    );
    if (updateResult.error) return { status: 'error', error: updateResult.error as CamsError };
    return { status: 'empty' };
  }

  const backfillResult = await backfillUstDivisionCodes(context, cases);
  if (backfillResult.error) {
    const updateResult = await updateBackfillState(
      context,
      { lastId: cursorLastId, processedCount: currentProcessedCount, status: 'FAILED' },
      existingState,
    );
    if (updateResult.error) {
      context.logger.error(MODULE_NAME, 'Failed to update backfill state after batch failure.');
    }
    return { status: 'error', error: backfillResult.error as CamsError };
  }

  const results = backfillResult.data ?? [];
  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);
  const newProcessedCount = currentProcessedCount + successCount;

  const updateResult = await updateBackfillState(
    context,
    {
      lastId: newLastId,
      processedCount: newProcessedCount,
      status: hasMore ? 'IN_PROGRESS' : 'COMPLETED',
    },
    existingState,
  );
  if (updateResult.error) return { status: 'error', error: updateResult.error as CamsError };

  return {
    status: 'ok',
    processedCount: newProcessedCount,
    successCount,
    failedResults,
    cases,
    nextCursor: hasMore ? { lastId: newLastId } : null,
  };
}

/**
 * Reads the current backfill state from the runtime-state collection.
 * Returns null if no state exists (first run).
 */
async function readBackfillState(
  context: ApplicationContext,
): Promise<MaybeData<UstDivisionCodeBackfillState | null>> {
  try {
    const repo = factory.getUstDivisionCodeBackfillStateRepo(context);
    const state = await repo.read('UST_DIVISION_CODE_BACKFILL_STATE');
    return { data: state };
  } catch (originalError) {
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
 */
async function updateBackfillState(
  context: ApplicationContext,
  updates: {
    lastId: string | null;
    processedCount: number;
    status: UstDivisionCodeBackfillState['status'];
  },
  existingState?: UstDivisionCodeBackfillState | null,
): Promise<MaybeData<UstDivisionCodeBackfillState>> {
  try {
    const repo = factory.getUstDivisionCodeBackfillStateRepo(context);
    const now = new Date().toISOString();

    let stateBase = existingState;
    if (stateBase === undefined) {
      const readResult = await readBackfillState(context);
      if (readResult.error) throw readResult.error;
      stateBase = readResult.data;
    }

    const state: UstDivisionCodeBackfillState = {
      id: stateBase?.id,
      documentType: 'UST_DIVISION_CODE_BACKFILL_STATE',
      lastId: updates.lastId,
      processedCount: updates.processedCount,
      startedAt: stateBase?.startedAt ?? now,
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

const BackfillUstDivisionCodeUseCase = {
  processBackfillPage,
  getPageOfCasesNeedingBackfillByCursor,
  backfillUstDivisionCodes,
  readBackfillState,
  updateBackfillState,
};

export default BackfillUstDivisionCodeUseCase;
