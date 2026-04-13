import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import factory from '../../factory';
import { MaybeData } from './queue-types';
import { CaseAppointmentDateBackfillState } from '../gateways.types';
import { CaseAppointment } from '@common/cams/trustee-appointments';

const MODULE_NAME = 'BACKFILL-CASE-APPOINTMENT-DATES-USE-CASE';

// _id is a MongoDB artifact unavoidable for cursor-based pagination
export type BackfillAppointment = CaseAppointment & { _id: string };

type CursorPageResult = {
  appointments: BackfillAppointment[];
  lastId: string | null;
  hasMore: boolean;
};

type CursorPageMaybeResult = MaybeData<CursorPageResult>;

/**
 * Gets a page of active CASE_APPOINTMENT documents missing appointedDate.
 * Uses cursor-based pagination on _id for resumability.
 */
async function getPageNeedingBackfill(
  context: ApplicationContext,
  lastId: string | null,
  limit: number,
): Promise<CursorPageMaybeResult> {
  try {
    const repo = factory.getTrusteeAppointmentsRepository(context);
    const results = await repo.findActiveMissingAppointedDate(lastId, limit + 1);

    const hasMore = results.length > limit;
    const appointments = results.slice(0, limit);
    const newLastId = appointments.length > 0 ? appointments[appointments.length - 1]._id : null;

    return {
      data: {
        appointments,
        lastId: newLastId,
        hasMore,
      },
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of appointments needing backfill (lastId: ${lastId}, limit: ${limit}).`,
      ),
    };
  }
}

export type BackfillResult = {
  caseId: string;
  success: boolean;
  error?: string;
};

export type ProcessBackfillPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | {
      status: 'ok';
      processedCount: number;
      successCount: number;
      newLastId: string | null;
      failedResults: BackfillResult[];
      appointments: BackfillAppointment[];
      nextCursor: { lastId: string | null } | null;
    };

/**
 * Backfills appointedDate for a batch of appointments.
 * Fetches apt_date from DXTR in a single batch query and writes it to CosmosDB.
 * Skips appointments where DXTR returns no date — does not fail the batch.
 */
async function backfillAppointmentDates(
  context: ApplicationContext,
  appointments: BackfillAppointment[],
): Promise<MaybeData<BackfillResult[]>> {
  const results: BackfillResult[] = [];

  try {
    const dxtrGateway = factory.getCasesGateway(context);
    const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

    const caseIds = appointments.map((a) => a.caseId);
    const appointedDateMap = await dxtrGateway.getAppointmentDatesByCaseIds(context, caseIds);

    let skippedNoDxtrDate = 0;

    for (const appointment of appointments) {
      try {
        const appointedDate = appointedDateMap.get(appointment.caseId);

        if (!appointedDate) {
          skippedNoDxtrDate++;
          context.logger.debug(
            MODULE_NAME,
            `No apt_date found in DXTR for case ${appointment.caseId} — skipping.`,
          );
          results.push({ caseId: appointment.caseId, success: true });
          continue;
        }

        await appointmentsRepo.updateCaseAppointment({ ...appointment, appointedDate });
        results.push({ caseId: appointment.caseId, success: true });
      } catch (originalError) {
        results.push({
          caseId: appointment.caseId,
          success: false,
          error: originalError instanceof Error ? originalError.message : String(originalError),
        });
      }
    }

    if (skippedNoDxtrDate > 0) {
      context.logger.info(
        MODULE_NAME,
        `Skipped ${skippedNoDxtrDate} appointments with no DXTR apt_date.`,
      );
    }
    return { data: results };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to backfill appointment dates for batch.',
      ),
    };
  }
}

/**
 * Coordinates a single backfill page: reads state, fetches the page, backfills dates,
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

  const pageResult = await getPageNeedingBackfill(context, cursorLastId, pageSize);
  if (pageResult.error || !pageResult.data) {
    return {
      status: 'error',
      error:
        (pageResult.error as CamsError) ??
        getCamsError(new Error('Unexpected missing data in page result'), MODULE_NAME),
    };
  }

  const { appointments, lastId: newLastId, hasMore } = pageResult.data;

  if (appointments.length === 0) {
    const updateResult = await updateBackfillState(
      context,
      { lastId: cursorLastId, processedCount: currentProcessedCount, status: 'COMPLETED' },
      existingState,
    );
    if (updateResult.error) return { status: 'error', error: updateResult.error as CamsError };
    return { status: 'empty' };
  }

  const backfillResult = await backfillAppointmentDates(context, appointments);
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
    newLastId,
    failedResults,
    appointments,
    nextCursor: hasMore ? { lastId: newLastId } : null,
  };
}

/**
 * Reads the current backfill state from the runtime-state collection.
 * Returns null if no state exists (first run).
 */
async function readBackfillState(
  context: ApplicationContext,
): Promise<MaybeData<CaseAppointmentDateBackfillState | null>> {
  try {
    const repo = factory.getCaseAppointmentDateBackfillStateRepo(context);
    const state = await repo.read('CASE_APPOINTMENT_DATE_BACKFILL_STATE');
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
    status: CaseAppointmentDateBackfillState['status'];
  },
  existingState?: CaseAppointmentDateBackfillState | null,
): Promise<MaybeData<CaseAppointmentDateBackfillState>> {
  try {
    const repo = factory.getCaseAppointmentDateBackfillStateRepo(context);
    const now = new Date().toISOString();

    let stateBase = existingState;
    if (stateBase === undefined) {
      try {
        stateBase = await repo.read('CASE_APPOINTMENT_DATE_BACKFILL_STATE');
      } catch (originalError) {
        if (!isNotFoundError(originalError)) {
          throw originalError;
        }
        stateBase = null;
      }
    }

    const state: CaseAppointmentDateBackfillState = {
      id: stateBase?.id,
      documentType: 'CASE_APPOINTMENT_DATE_BACKFILL_STATE',
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

const BackfillCaseAppointmentDatesUseCase = {
  processBackfillPage,
  getPageNeedingBackfill,
  backfillAppointmentDates,
  readBackfillState,
  updateBackfillState,
};

export default BackfillCaseAppointmentDatesUseCase;
