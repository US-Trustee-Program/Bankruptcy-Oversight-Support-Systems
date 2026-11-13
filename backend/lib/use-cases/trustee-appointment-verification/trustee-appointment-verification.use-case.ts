import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import {
  CaseAppointmentChecks,
  CaseAppointmentDocumentType,
  hasAppointmentForCase,
  scoreAppointmentAgreement,
  TrusteeAppointment,
} from '@common/cams/trustee-appointments';
import {
  AppointmentTaskReason,
  TrusteeAppointmentVerification,
  TrusteeAppointmentVerificationDetail,
  TrusteeAppointmentVerificationListItem,
} from '@common/cams/trustee-appointment-verification';
import { CourtDivisionDetails } from '@common/cams/courts';
import { CourtsUseCase } from '../courts/courts';
import { TrusteeAppointmentsUseCase } from '../trustee-appointments/trustee-appointments';

/** The case-appointment write a caller just made, as far as the appointment-task rule needs it. */
export type AppointmentTaskWrite = {
  caseId: string;
  trusteeId: string;
  courtId?: string;
  courtDivisionCode?: string;
  chapter?: string;
  unassignedOn?: string;
  documentType: CaseAppointmentDocumentType;
  checks?: CaseAppointmentChecks;
};

type AppointmentTaskCandidate = AppointmentTaskWrite & {
  courtId: string;
  courtDivisionCode: string;
  chapter: string;
  checks: CaseAppointmentChecks;
};

/**
 * The appointment-task predicate: an open (no unassignedOn), attached (CASE_APPOINTMENT) write
 * whose case and trustee were both identified, that no active appointment covers, with court,
 * division and chapter all present. A closed appointment is excluded because a task asserts the
 * trustee serves the case now; a historical appointment is not something a verifier can resolve
 * (cams-0yr5n.1.6). Exported so a caller can skip fetching
 * the trustee's appointments when no task applies.
 */
export function isAppointmentTaskCandidate(
  appointment: AppointmentTaskWrite,
): appointment is AppointmentTaskCandidate {
  const { courtId, courtDivisionCode, chapter, unassignedOn, documentType, checks } = appointment;
  return (
    documentType === 'CASE_APPOINTMENT' &&
    !unassignedOn &&
    !!checks?.matchedCase &&
    checks.matchedTrustee &&
    !checks.matchedTrusteeAppointment &&
    !!courtId &&
    !!courtDivisionCode &&
    !!chapter
  );
}

/**
 * CAMS-956: an attached case appointment whose case and trustee were both identified, but whose
 * trustee holds no active appointment covering the case's court, division and chapter, belongs to
 * a "Trustee Appointment" task for that (trustee, court, division, chapter). Every site that
 * writes a case appointment calls this right after its write; the repository's atomic upsert
 * makes repeat calls for the same case a no-op.
 *
 * Does nothing unless isAppointmentTaskCandidate holds.
 *
 * `trusteeAppointments` is the trustee's full appointment list, which every caller has already
 * fetched to compute checks. Errors propagate; the caller decides whether to retry.
 */
export async function openOrJoinAppointmentTask(
  context: ApplicationContext,
  appointment: AppointmentTaskWrite,
  trusteeAppointments: TrusteeAppointment[],
  user: CamsUserReference = SYSTEM_USER_REFERENCE,
): Promise<void> {
  if (!isAppointmentTaskCandidate(appointment)) return;
  const { caseId, trusteeId, courtId, courtDivisionCode, chapter } = appointment;

  const reason: AppointmentTaskReason = hasAppointmentForCase(
    trusteeAppointments,
    courtId,
    courtDivisionCode,
    chapter,
  )
    ? 'appointment-inactive'
    : 'no-appointment';

  await factory
    .getTrusteeAppointmentVerificationRepository(context)
    .openOrJoin(
      { trusteeId, courtId, divisionCode: courtDivisionCode, chapter },
      caseId,
      reason,
      user,
    );
}

/**
 * Resolves a task's (courtId, divisionCode) tuple against the courts list, the same way for the
 * queue row and the detail view: a name that can't be resolved is left out rather than guessed.
 */
function resolveTaskCourtNames(
  task: Pick<TrusteeAppointmentVerification, 'courtId' | 'divisionCode'>,
  courts: CourtDivisionDetails[],
): { courtName?: string; courtDivisionName?: string } {
  const division = courts.find(
    (c) => c.courtId === task.courtId && c.courtDivisionCode === task.divisionCode,
  );
  const courtName = (division ?? courts.find((c) => c.courtId === task.courtId))?.courtName;
  return {
    ...(courtName ? { courtName } : {}),
    ...(division ? { courtDivisionName: division.courtDivisionName } : {}),
  };
}

function toListItem(
  task: TrusteeAppointmentVerification,
  courts: CourtDivisionDetails[],
): TrusteeAppointmentVerificationListItem {
  const { courtName, courtDivisionName } = resolveTaskCourtNames(task, courts);
  return {
    id: task.id,
    documentType: task.documentType,
    taskType: task.taskType,
    trusteeId: task.trusteeId,
    courtId: task.courtId,
    ...(courtName ? { courtName } : {}),
    divisionCode: task.divisionCode,
    ...(courtDivisionName ? { courtDivisionName } : {}),
    chapter: task.chapter,
    reason: task.reason,
    status: task.status,
    taskDate: task.createdOn,
    caseCount: task.caseIds.length,
  };
}

/**
 * The open (pending) appointment tasks for the Data Verification queue, with court and division
 * names resolved from the courts list. A name that can't be resolved is left out; the queue then
 * shows the court id or division code instead.
 */
export async function listAppointmentTasks(
  context: ApplicationContext,
): Promise<TrusteeAppointmentVerificationListItem[]> {
  const tasks = await factory
    .getTrusteeAppointmentVerificationRepository(context)
    .search({ status: ['pending'] });
  const courts = await new CourtsUseCase().getCourts(context);
  return tasks.map((task) => toListItem(task, courts));
}

/**
 * One appointment task's full detail (CAMS-956 Slice 2), fetched when a data verifier expands its
 * row: court/division names resolved the same way as the queue row, plus the trustee's full
 * appointment list scored and sorted by how closely each one agrees with the task's (court,
 * division, chapter) tuple -- closest agreement first, ties broken by the most recently appointed.
 * Propagates a not-found error from the repository when the task does not exist.
 */
export async function getAppointmentTaskDetail(
  context: ApplicationContext,
  id: string,
): Promise<TrusteeAppointmentVerificationDetail> {
  const task = await factory.getTrusteeAppointmentVerificationRepository(context).findById(id);
  const courts = await new CourtsUseCase().getCourts(context);
  const trusteeAppointments = await new TrusteeAppointmentsUseCase(context).getTrusteeAppointments(
    context,
    task.trusteeId,
  );

  // Falls back to the trusteeId so the UI always has something to show/link when the trustee
  // record itself can't be read, the same resilience as trustee-match-verification's
  // resolvedTrusteeName lookup.
  let trusteeName = task.trusteeId;
  try {
    const trustee = await factory.getTrusteesRepository(context).read(task.trusteeId);
    trusteeName = trustee.name;
  } catch {
    // name unavailable -- UI falls back to the trustee id
  }

  const appointments = trusteeAppointments
    .map((appointment) => ({
      ...appointment,
      agreement: scoreAppointmentAgreement(
        appointment,
        task.courtId,
        task.divisionCode,
        task.chapter,
      ),
    }))
    .sort(
      (a, b) =>
        b.agreement.score - a.agreement.score || b.appointedDate.localeCompare(a.appointedDate),
    );

  return {
    ...task,
    ...resolveTaskCourtNames(task, courts),
    trusteeName,
    appointments,
  };
}
