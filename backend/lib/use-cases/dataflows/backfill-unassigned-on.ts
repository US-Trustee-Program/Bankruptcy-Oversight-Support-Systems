import { ApplicationContext } from '../../adapters/types/basic';
import { CamsError } from '../../common-errors/cams-error';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { MaybeData } from './queue-types';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import DateHelper from '@common/date-helper';
import { SENTINEL_TRUSTEE_ID } from './migrate-case-appointments-constants';

const MODULE_NAME = 'BACKFILL-UNASSIGNED-ON-USE-CASE';

// _id is a MongoDB artifact unavoidable for cursor-based pagination
export type BackfillAppointment = CaseAppointment & { _id: string };

type CursorPageResult = {
  appointments: BackfillAppointment[];
  lastId: string | null;
  hasMore: boolean;
};

type CursorPageMaybeResult = MaybeData<CursorPageResult>;

/**
 * Gets a page of soft-closed, real (non-surrogate/non-sentinel) CASE_APPOINTMENT documents.
 * Uses cursor-based pagination on _id for resumability across pages of a single run. Whether a
 * given candidate actually needs correcting can only be determined per-record (it depends on that
 * case's superseding appointment, which isn't expressible as a single-document Mongo filter) — see
 * correctUnassignedOn.
 */
async function getPageNeedingBackfill(
  context: ApplicationContext,
  lastId: string | null,
  limit: number,
): Promise<CursorPageMaybeResult> {
  try {
    const repo = factory.getTrusteeCaseAppointmentsRepository(context);
    const results = await repo.findClosedAppointments(lastId, limit + 1);

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

type BackfillResult = {
  _id: string;
  caseId: string;
  success: boolean;
  error?: string;
};

type ProcessBackfillPageResult =
  | { status: 'error'; error: CamsError }
  | { status: 'empty' }
  | {
      status: 'ok';
      successCount: number;
      newLastId: string | null;
      failedResults: BackfillResult[];
      appointments: BackfillAppointment[];
      nextCursor: { lastId: string | null } | null;
    };

/**
 * The earliest appointment by assignedOn. Logs a warning (does not throw) on an assignedOn tie
 * between two candidates — mirrors getActiveByCaseId's AMBIGUOUS ACTIVE APPOINTMENT warning for
 * the same shape of ambiguity — since this migration runs against potentially years of dirty
 * historical data where a tie is a real data-quality signal worth surfacing for review, not a
 * reason to abort the correction (an arbitrary-but-logged choice is still strictly better than
 * leaving the old wall-clock-derived unassignedOn in place).
 */
function earliestBy(
  context: ApplicationContext,
  appointments: CaseAppointment[],
): CaseAppointment | null {
  if (appointments.length === 0) {
    return null;
  }
  const earliest = appointments.reduce((current, candidate) =>
    candidate.assignedOn < current.assignedOn ? candidate : current,
  );
  const tied = appointments.filter((a) => a.assignedOn === earliest.assignedOn);
  if (tied.length > 1) {
    context.logger.warn(
      MODULE_NAME,
      `AMBIGUOUS SUPERSEDING APPOINTMENT: case ${earliest.caseId} has multiple candidate ` +
        `superseding appointments with the same assignedOn (${earliest.assignedOn}). Using ` +
        `trusteeId ${earliest.trusteeId} (appointment id ${earliest.id}) arbitrarily — this ` +
        `choice is NOT guaranteed stable across runs. Investigate and resolve the duplicate ` +
        `appointment for this case.`,
      {
        caseId: earliest.caseId,
        assignedOn: earliest.assignedOn,
        candidateIds: tied.map((a) => a.id),
      },
    );
  }
  return earliest;
}

/**
 * The appointment on the same case whose assignedOn is the earliest one strictly after closed's
 * own assignedOn — mirrors how applyResolvedTrustee (sync-trustee-case-appointments.ts) reasons
 * about appointment ordering. Excludes fingerprint-based surrogate rows (isSurrogate: true), the
 * placeholder mechanism the current sync dataflow uses, and legacy SENTINEL_TRUSTEE_ID rows left
 * over from the older migrate-case-appointments dataflow (not yet healed across all cases), so
 * neither kind of placeholder is mistaken for a real superseding appointment.
 *
 * Prefers the earliest later appointment belonging to a *different* trustee — the real handoff.
 * Falls back to the earliest later same-trustee appointment (e.g. trustee A leaves and is
 * reassigned to the same case before anyone else ever takes over) only when no different-trustee
 * candidate exists at all: this backfill only overwrites an already-set (and, per CAMS-888,
 * already-known-wrong) unassignedOn, so using a same-trustee re-assignment date here is strictly
 * safer than leaving the old wall-clock-derived value in place, even though it isn't a real
 * handoff to a new trustee. Returns null only when no later appointment of any kind exists (closed
 * is the currently-active one, or a genuine close-only terminal state) — there is nothing to
 * correct against in that case.
 */
function findSupersedingAppointment(
  context: ApplicationContext,
  closed: CaseAppointment,
  caseHistory: CaseAppointment[],
): CaseAppointment | null {
  const laterRealAppointments = caseHistory.filter(
    (a) =>
      a.id !== closed.id &&
      !a.isSurrogate &&
      // TODO: drop once legacy SENTINEL_TRUSTEE_ID rows are healed off all cases.
      a.trusteeId !== SENTINEL_TRUSTEE_ID &&
      a.assignedOn > closed.assignedOn,
  );
  const differentTrusteeAppointments = laterRealAppointments.filter(
    (a) => a.trusteeId !== closed.trusteeId,
  );
  return (
    earliestBy(context, differentTrusteeAppointments) ?? earliestBy(context, laterRealAppointments)
  );
}

/**
 * Corrects unassignedOn for a batch of soft-closed appointments. For each, finds the superseding
 * appointment on the same case and derives the correct unassignedOn (one day before the
 * superseding appointment's assignedOn) via DateHelper.subtractDays — the same derivation
 * softCloseExistingAppointment uses. Skips (reports success, does not write) when the appointment
 * is already correct, or when no superseding appointment exists — fabricating a date without one
 * to correct against would be worse than leaving it alone.
 */
async function correctUnassignedOn(
  context: ApplicationContext,
  appointments: BackfillAppointment[],
): Promise<MaybeData<BackfillResult[]>> {
  const results: BackfillResult[] = [];

  try {
    const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);

    for (const appointment of appointments) {
      try {
        const caseHistory = await appointmentsRepo.getByCaseId(appointment.caseId);
        const superseding = findSupersedingAppointment(context, appointment, caseHistory);

        if (!superseding) {
          context.logger.debug(
            MODULE_NAME,
            `No superseding appointment found for case ${appointment.caseId} — nothing to correct against. Skipping.`,
          );
          results.push({ _id: appointment._id, caseId: appointment.caseId, success: true });
          continue;
        }

        // DateHelper.subtractDays silently returns its input unchanged on an invalid date string
        // rather than throwing — since this migration explicitly targets historically-dirty data,
        // an unvalidated malformed assignedOn here would get written straight into unassignedOn
        // via updateCaseAppointment below. Log then throw, matching applyResolvedTrustee/
        // writeSurrogateAppointment's convention (sync-trustee-case-appointments.ts) of logging a
        // distinctly-tagged error at the point of detection rather than only surfacing later via
        // the generic per-item catch/DLQ path.
        if (!DateHelper.isValidDateString(superseding.assignedOn)) {
          context.logger.error(
            MODULE_NAME,
            `TRUSTEE APPOINTMENT DATA INTEGRITY ERROR: case ${appointment.caseId} — superseding ` +
              `appointment ${superseding.id} has an invalid assignedOn (${superseding.assignedOn}). ` +
              `Refusing to derive unassignedOn from it.`,
          );
          throw new CamsError(MODULE_NAME, {
            message: `Case ${appointment.caseId}: superseding appointment ${superseding.id} has an invalid assignedOn (${superseding.assignedOn}), cannot safely derive unassignedOn.`,
          });
        }

        const correctUnassignedOnValue = DateHelper.subtractDays(superseding.assignedOn, 1);
        if (appointment.unassignedOn === correctUnassignedOnValue) {
          results.push({ _id: appointment._id, caseId: appointment.caseId, success: true });
          continue;
        }

        await appointmentsRepo.updateCaseAppointment({
          ...appointment,
          unassignedOn: correctUnassignedOnValue,
        });
        results.push({ _id: appointment._id, caseId: appointment.caseId, success: true });
      } catch (originalError) {
        results.push({
          _id: appointment._id,
          caseId: appointment.caseId,
          success: false,
          error: originalError instanceof Error ? originalError.message : String(originalError),
        });
      }
    }

    return { data: results };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to correct unassignedOn for batch.'),
    };
  }
}

/**
 * Coordinates a single backfill page: fetches the page, corrects unassignedOn for each candidate.
 * Returns a discriminated result the handler uses for queue I/O. No progress state is persisted
 * across separate runs of the migration — findClosedAppointments' candidate query only narrows to
 * "closed", not "wrong", so an already-correct record is still fetched, but correctUnassignedOn is
 * a no-op for it. Re-running the whole migration is therefore always safe and simply converges to
 * a batch of all-skipped results once every candidate is correct.
 */
async function processBackfillPage(
  context: ApplicationContext,
  cursorLastId: string | null,
  pageSize: number,
): Promise<ProcessBackfillPageResult> {
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
    return { status: 'empty' };
  }

  const correctionResult = await correctUnassignedOn(context, appointments);
  if (correctionResult.error) {
    return { status: 'error', error: correctionResult.error as CamsError };
  }

  const results = correctionResult.data ?? [];
  const successCount = results.filter((r) => r.success).length;
  const failedResults = results.filter((r) => !r.success);

  return {
    status: 'ok',
    successCount,
    newLastId,
    failedResults,
    appointments,
    nextCursor: hasMore ? { lastId: newLastId } : null,
  };
}

const BackfillUnassignedOnUseCase = {
  processBackfillPage,
  getPageNeedingBackfill,
  correctUnassignedOn,
  findSupersedingAppointment,
};

export default BackfillUnassignedOnUseCase;
