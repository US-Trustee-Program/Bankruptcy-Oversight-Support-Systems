import DateHelper from '@common/date-helper';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import {
  CaseAppointmentChecks,
  CaseAppointmentInput,
  isAppointmentMatch,
} from '@common/cams/trustee-appointments';
import { getCamsError } from '../../common-errors/error-utilities';
import { isTransientInfraError } from '../../common-errors/transient-infra-error';
import { ParkedAppointment } from '../gateways.types';
import {
  applyResolvedTrustee,
  SyncTrusteeCaseAppointmentsDeps,
} from './sync-trustee-case-appointments';

const MODULE_NAME = 'HEAL-PARKED-CASE-APPOINTMENTS-USE-CASE';

/** Parked rows filed within this many days of the heal run date are healed; older ones are abandoned. */
const HEAL_WINDOW_DAYS = 14;

/** matchedBy for a parked appointment written by an identity-task remap, which records no checks. */
const IDENTITY_TASK_MATCHED_BY = 'identity-task';

export type HealParkedDeps = Pick<
  SyncTrusteeCaseAppointmentsDeps,
  'context' | 'casesRepo' | 'appointmentsRepo' | 'caseAppointmentsRepo'
>;

export type HealParkedPageResult = {
  healed: number;
  stillParked: number;
  failed: number;
  /** Greatest _id on this page; null when the page was empty (the run is done). */
  nextLastId: string | null;
};

/** Earliest dateFiled the heal reads: healRunDate minus HEAL_WINDOW_DAYS. */
export function healWindowStart(healRunDate: string): string {
  return DateHelper.subtractDays(healRunDate, HEAL_WINDOW_DAYS);
}

/** The dateFiled that aged out of the window on this run (the day before healWindowStart). */
export function abandonedFiledDate(healRunDate: string): string {
  return DateHelper.subtractDays(healRunDate, HEAL_WINDOW_DAYS + 1);
}

/**
 * Parked rows that aged out of the heal window on this run. Counted once per run, so summing the
 * daily counts gives the total abandoned (evidence for GitHub #3194).
 */
export async function countAbandoned(deps: HealParkedDeps, healRunDate: string): Promise<number> {
  return deps.caseAppointmentsRepo.countParkedFiledOn(abandonedFiledDate(healRunDate));
}

function placedPlaceholderFrom(row: ParkedAppointment): CaseAppointmentInput {
  return {
    caseId: row.caseId,
    trusteeId: row.trusteeId,
    assignedOn: row.assignedOn,
    appointedDate: row.appointedDate,
    ...(row.unassignedOn ? { unassignedOn: row.unassignedOn } : {}),
    isSurrogate: true,
    variant: row.variant,
    courtId: row.courtId,
    courtDivisionCode: row.courtDivisionCode,
    chapter: row.chapter,
    dateFiled: row.dateFiled,
  };
}

/**
 * Rebuilds the event-shaped input applyResolvedTrustee takes from the stored row. Parked rows only
 * ever come from the ACMS source. Court fields are whatever the row recorded when it was written;
 * a missing one leaves the appointment uncovered (see attachParkedAppointment).
 */
function eventFrom(row: ParkedAppointment): TrusteeAppointmentSyncEvent {
  return {
    caseId: row.caseId,
    courtId: row.courtId,
    courtDivisionCode: row.courtDivisionCode,
    chapter: row.chapter,
    dateFiled: row.dateFiled,
    appointedDate: row.appointedDate ?? row.assignedOn,
    ...(row.unassignedOn ? { unassignedOn: row.unassignedOn } : {}),
    source: 'ACMS',
    sourceTrustee: { fullName: '' },
  };
}

/** Returns false when the old trustee's appointment could not be closed (see healParkedPage). */
/**
 * True when the sync already wrote this court appointment as a placed row (same trustee or
 * fingerprint, same assignedOn day): it did so after the case loaded, from newer source data, so
 * the parked row is out of date. Placed and parked rows have different natural keys, so attaching
 * the parked row would replace the placed row, e.g. reopening an appointment a later DISP_DATE
 * closed. applyResolvedTrustee alone cannot see this: it only looks at the active appointment.
 */
async function isSupersededByPlacedRow(
  deps: HealParkedDeps,
  row: ParkedAppointment,
): Promise<boolean> {
  const placedRows = await deps.caseAppointmentsRepo.getByCaseId(row.caseId);
  return placedRows.some(
    (placed) =>
      placed.trusteeId === row.trusteeId &&
      placed.assignedOn.slice(0, 10) === row.assignedOn.slice(0, 10),
  );
}

async function attachParkedAppointment(
  deps: HealParkedDeps,
  row: ParkedAppointment,
): Promise<boolean> {
  const trusteeAppointments = await deps.appointmentsRepo.getTrusteeAppointments(row.trusteeId);
  const covered =
    !!row.courtId &&
    !!row.courtDivisionCode &&
    !!row.chapter &&
    isAppointmentMatch(trusteeAppointments, row.courtId, row.courtDivisionCode, row.chapter);
  const checks: CaseAppointmentChecks = {
    matchedCase: true,
    matchedTrustee: true,
    matchedTrusteeAppointment: covered,
    matchedBy: row.checks?.matchedBy ?? IDENTITY_TASK_MATCHED_BY,
  };
  const softCloseFailure = await applyResolvedTrustee(
    deps.context,
    eventFrom(row),
    row.trusteeId,
    deps.caseAppointmentsRepo,
    checks,
  );
  return softCloseFailure === null;
}

/**
 * Heals one page of parked rows (CASE_APPOINTMENT_UNATTACHED) filed within the heal window. For a
 * row whose case is now in CAMS and not moved: a parked appointment is applied under the
 * active-trustee rule (applyResolvedTrustee, latest-wins against the case's appointments) with
 * checks.matchedTrusteeAppointment recomputed; a parked placeholder becomes a placed placeholder.
 * Then the parked row is deleted. Upsert before delete: a failed delete re-upserts the same
 * natural key next run. A row whose case is still missing (or moved) stays parked. A row the sync
 * already wrote as a placed row (isSupersededByPlacedRow) is deleted without writing anything.
 *
 * When applyResolvedTrustee reports a permanent soft-close failure, the new appointment is already
 * written but the previous trustee's appointment is still open. The parked row is kept and counted
 * failed, with the error logged for manual replay (the sync dead-letters the same case). The next
 * heal finds the new appointment active for this trustee and clears the parked row.
 *
 * Cursor-paged on _id, so rows left parked never stall progress. A transient error is rethrown
 * for the caller's rate-limit retry; any other per-row error is logged and the row left parked.
 */
export async function healParkedPage(
  deps: HealParkedDeps,
  options: { healRunDate: string; lastId: string | null; pageSize: number },
): Promise<HealParkedPageResult> {
  const { context } = deps;
  const rows = await deps.caseAppointmentsRepo.findParkedFiledOnOrAfter(
    healWindowStart(options.healRunDate),
    options.lastId,
    options.pageSize,
  );
  const result: HealParkedPageResult = { healed: 0, stillParked: 0, failed: 0, nextLastId: null };

  for (const row of rows) {
    result.nextLastId = row._id;
    try {
      const caseOrMovedCase = await deps.casesRepo.getCaseOrMovedCase(row.caseId);
      if (!caseOrMovedCase || caseOrMovedCase.movedToCaseId) {
        result.stillParked++;
        continue;
      }

      if (await isSupersededByPlacedRow(deps, row)) {
        // Nothing to write; clearing the stale parked row counts as healed.
      } else if (row.isSurrogate) {
        await deps.caseAppointmentsRepo.upsert(placedPlaceholderFrom(row));
      } else if (!(await attachParkedAppointment(deps, row))) {
        context.logger.error(
          MODULE_NAME,
          `Attached parked appointment ${row.id} for case ${row.caseId}, but the previous trustee's appointment could not be closed; left parked. Manual replay required.`,
          { caseId: row.caseId, id: row.id },
        );
        result.failed++;
        continue;
      }
      await deps.caseAppointmentsRepo.delete(row.id);
      result.healed++;
    } catch (originalError) {
      if (isTransientInfraError(originalError)) throw originalError;
      const error = getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to heal parked appointment ${row.id} for case ${row.caseId}; left parked.`,
      );
      context.logger.error(MODULE_NAME, error.message, { caseId: row.caseId, id: row.id });
      result.failed++;
    }
  }

  return result;
}

const HealParkedCaseAppointments = {
  healParkedPage,
  countAbandoned,
};

export default HealParkedCaseAppointments;
