import { SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import factory from '../../factory';
import QueryBuilder from '../../query/query-builder';
import { MaybeData } from './queue-types';
import { UstDivisionCodeBackfillState } from '../gateways.types';

const MODULE_NAME = 'BACKFILL-UST-DIVISION-CODE-USE-CASE';

const { and, using } = QueryBuilder;

const BASE_DELAY_MS = 30_000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function computeNextBackoffMs(attempt: number, baseDelayMs: number): number {
  return Math.min(Math.pow(2, attempt + 1) * baseDelayMs, MAX_BACKOFF_MS);
}

// Stays under the 01:00:00 functionTimeout in host.json, matching the sibling dataflows.
const SAFE_THRESHOLD_MS = 56 * 60 * 1000;

type BackfillWriteOptions = {
  startedAt: number;
  safeThresholdMs: number;
  baseDelayMs: number;
};

type BackfillBatchResult = {
  results: BackfillResult[];
  // True when a throttled write's next backoff would cross safeThresholdMs; the cases after the
  // last result were not attempted.
  escaped: boolean;
};

// Scoped to Eastern District of TN (court 0649) only — this is the only district where bare
// CS_DIV and CS_DIV_ACMS diverge that CAMS-936 addresses. The DXTR gateways scope ustDivisionCode
// to the same court (ustDivisionCodeSelect), so the two stay in step. Nationwide follow-up for the
// eight other courts with shared ACMS codes: cams-06edp.
const EASTERN_DISTRICT_TN_COURT_ID = '0649';

// E.D. Tenn ACMS codes shared by two bare CS_DIVs (DXTR AO_CS_DIV), keyed by the division name
// synced onto the case (AO_OFFICE.OFFICE_NAME_DISPLAY via the bare division's OFFICE_CODE).
// Any other 0649 ACMS code has CS_DIV === CS_DIV_ACMS.
const SHARED_ACMS_DIVISIONS: Record<string, Record<string, string>> = {
  '491': { Chattanooga: '491', Winchester: '494' },
  '492': { Greeneville: '492', 'Johnson City': '495' },
};

/**
 * Returns undefined when a shared ACMS code carries a name we can't place, so the case is
 * skipped rather than silently assigned the ACMS code's own division.
 */
function resolveUstDivisionCode(
  courtDivisionCode: string,
  courtDivisionName: string | undefined,
): string | undefined {
  const byName = SHARED_ACMS_DIVISIONS[courtDivisionCode];
  if (!byName) return courtDivisionCode;
  return byName[courtDivisionName?.trim() ?? ''];
}

type SyncedCaseQueryable = SyncedCase & { _id: string };

export type BackfillCase = {
  _id: string;
  caseId: string;
  courtDivisionCode: string;
  courtDivisionName?: string;
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
      // Moved cases keep their old caseId and are re-synced under the new one.
      doc('movedToCaseId').notExists(),
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
        cases: cases.map((c) => ({
          _id: c._id,
          caseId: c.caseId,
          courtDivisionCode: c.courtDivisionCode,
          courtDivisionName: c.courtDivisionName,
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

type BackfillResult = {
  caseId: string;
  success: boolean;
  error?: string;
  skipped?: boolean;
};

type ProcessBackfillPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | {
      status: 'ok';
      processedCount: number;
      successCount: number;
      skippedCount: number;
      failedResults: BackfillResult[];
      cases: BackfillCase[];
      nextCursor: { lastId: string | null } | null;
    };

/**
 * Backfills ustDivisionCode for a batch of cases, resolving it from the division fields already
 * synced onto each case (no DXTR call). Skips cases whose shared ACMS code carries an
 * unrecognized division name — does not fail the batch.
 */
async function backfillUstDivisionCodes(
  context: ApplicationContext,
  cases: BackfillCase[],
  options: Partial<BackfillWriteOptions> = {},
): Promise<BackfillBatchResult> {
  const startedAt = options.startedAt ?? Date.now();
  const safeThresholdMs = options.safeThresholdMs ?? SAFE_THRESHOLD_MS;
  const baseDelayMs = options.baseDelayMs ?? BASE_DELAY_MS;
  const results: BackfillResult[] = [];
  const casesRepo = factory.getCasesRepository(context);
  const skippedCaseIds: string[] = [];

  for (const bCase of cases) {
    const ustDivisionCode = resolveUstDivisionCode(
      bCase.courtDivisionCode,
      bCase.courtDivisionName,
    );

    if (!ustDivisionCode) {
      skippedCaseIds.push(bCase.caseId);
      results.push({ caseId: bCase.caseId, success: true, skipped: true });
      continue;
    }

    let attempt = 0;
    while (true) {
      try {
        await casesRepo.setUstDivisionCode(bCase._id, bCase.caseId, ustDivisionCode);
        results.push({ caseId: bCase.caseId, success: true });
        break;
      } catch (originalError) {
        if (isTooManyRequestsError(originalError)) {
          const nextBackoffMs = computeNextBackoffMs(attempt, baseDelayMs);
          if (Date.now() - startedAt + nextBackoffMs >= safeThresholdMs) {
            logSkipped(context, skippedCaseIds);
            return { results, escaped: true };
          }
          await sleep(nextBackoffMs);
          attempt++;
          continue;
        }
        results.push({
          caseId: bCase.caseId,
          success: false,
          error: originalError instanceof Error ? originalError.message : String(originalError),
        });
        break;
      }
    }
  }

  logSkipped(context, skippedCaseIds);
  return { results, escaped: false };
}

function logSkipped(context: ApplicationContext, skippedCaseIds: string[]) {
  if (skippedCaseIds.length === 0) return;
  context.logger.warn(
    MODULE_NAME,
    `Skipped ${skippedCaseIds.length} case(s) whose division name did not resolve: ${skippedCaseIds.join(', ')}.`,
  );
}

/**
 * A case that failed to update (not a DXTR miss) can still exhaust its retries and land in
 * HARD_STOP, after which nothing will revisit it: the cursor has already advanced past its _id,
 * so a resumed run's `_id > lastId` filter permanently excludes it even though it still matches
 * `ustDivisionCode.notExists()`. Surface that in the terminal status rather than reporting a
 * clean COMPLETED whenever this page had unresolved write failures.
 */
function determineTerminalStatus(
  skippedCount: number,
  failedCount: number,
): UstDivisionCodeBackfillState['status'] {
  if (failedCount > 0) return 'COMPLETED_WITH_FAILURES';
  if (skippedCount > 0) return 'COMPLETED_WITH_SKIPS';
  return 'COMPLETED';
}

/**
 * On escape, resume after the last case actually processed: cases already written drop out of
 * the page query (ustDivisionCode now exists), and unattempted ones are re-read next page.
 * Each processed case yields exactly one result, in page order.
 */
function lastProcessedId(
  cases: BackfillCase[],
  results: BackfillResult[],
  cursorLastId: string | null,
): string | null {
  return results.length > 0 ? cases[results.length - 1]._id : cursorLastId;
}

/**
 * Coordinates a single backfill page: reads state, fetches the page, backfills codes,
 * and updates state. Returns a discriminated result the handler uses for queue I/O.
 */
async function processBackfillPage(
  context: ApplicationContext,
  cursorLastId: string | null,
  pageSize: number,
  options: Partial<BackfillWriteOptions> = {},
): Promise<ProcessBackfillPageResult> {
  const stateResult = await readBackfillState(context);
  if (stateResult.error) return { status: 'error', error: stateResult.error as CamsError };

  const existingState = stateResult.data;
  const currentProcessedCount = existingState?.processedCount ?? 0;
  const currentSkippedCount = existingState?.skippedCount ?? 0;
  const currentFailedCount = existingState?.failedCount ?? 0;

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
      {
        lastId: cursorLastId,
        processedCount: currentProcessedCount,
        skippedCount: currentSkippedCount,
        failedCount: currentFailedCount,
        status: determineTerminalStatus(currentSkippedCount, currentFailedCount),
      },
      existingState,
    );
    if (updateResult.error) return { status: 'error', error: updateResult.error as CamsError };
    return { status: 'empty' };
  }

  const { results, escaped } = await backfillUstDivisionCodes(context, cases, options);
  const pageLastId = escaped ? lastProcessedId(cases, results, cursorLastId) : newLastId;
  const pageHasMore = escaped || hasMore;

  const successCount = results.filter((r) => r.success && !r.skipped).length;
  const skippedCount = results.filter((r) => r.skipped).length;
  const failedResults = results.filter((r) => !r.success);
  const newProcessedCount = currentProcessedCount + successCount + skippedCount;
  const newSkippedCount = currentSkippedCount + skippedCount;
  const newFailedCount = currentFailedCount + failedResults.length;

  const updateResult = await updateBackfillState(
    context,
    {
      lastId: pageLastId,
      processedCount: newProcessedCount,
      skippedCount: newSkippedCount,
      failedCount: newFailedCount,
      status: pageHasMore
        ? 'IN_PROGRESS'
        : determineTerminalStatus(newSkippedCount, newFailedCount),
    },
    existingState,
  );
  if (updateResult.error) return { status: 'error', error: updateResult.error as CamsError };

  return {
    status: 'ok',
    processedCount: newProcessedCount,
    successCount,
    skippedCount,
    failedResults,
    cases,
    nextCursor: pageHasMore ? { lastId: pageLastId } : null,
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
    skippedCount?: number;
    failedCount?: number;
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
      skippedCount: updates.skippedCount ?? stateBase?.skippedCount ?? 0,
      failedCount: updates.failedCount ?? stateBase?.failedCount ?? 0,
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
  resolveUstDivisionCode,
  processBackfillPage,
  getPageOfCasesNeedingBackfillByCursor,
  backfillUstDivisionCodes,
  readBackfillState,
  updateBackfillState,
};

export default BackfillUstDivisionCodeUseCase;
