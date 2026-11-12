import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import {
  CaseAppointmentChecks,
  CaseAppointmentDocumentType,
  hasAppointmentForCase,
  TrusteeAppointment,
} from '@common/cams/trustee-appointments';
import {
  AppointmentTaskReason,
  TrusteeAppointmentVerification,
  TrusteeAppointmentVerificationListItem,
} from '@common/cams/trustee-appointment-verification';
import { CourtDivisionDetails } from '@common/cams/courts';
import { CourtsUseCase } from '../courts/courts';

/** The case-appointment write a caller just made, as far as the appointment-task rule needs it. */
export type AppointmentTaskWrite = {
  caseId: string;
  trusteeId: string;
  courtId?: string;
  courtDivisionCode?: string;
  chapter?: string;
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
 * The appointment-task predicate: an attached (CASE_APPOINTMENT) write whose case and trustee
 * were both identified, that no active appointment covers, with court, division and chapter all
 * present. Exported so a caller can skip fetching the trustee's appointments when no task applies.
 */
export function isAppointmentTaskCandidate(
  appointment: AppointmentTaskWrite,
): appointment is AppointmentTaskCandidate {
  const { courtId, courtDivisionCode, chapter, documentType, checks } = appointment;
  return (
    documentType === 'CASE_APPOINTMENT' &&
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
 * Does nothing for a parked (CASE_APPOINTMENT_UNATTACHED) row, a placeholder (matchedTrustee
 * false), a covered appointment, or a row missing any of court, division or chapter.
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

function toListItem(
  task: TrusteeAppointmentVerification,
  courts: CourtDivisionDetails[],
): TrusteeAppointmentVerificationListItem {
  const division = courts.find(
    (c) => c.courtId === task.courtId && c.courtDivisionCode === task.divisionCode,
  );
  const courtName = (division ?? courts.find((c) => c.courtId === task.courtId))?.courtName;
  return {
    id: task.id,
    documentType: task.documentType,
    taskType: task.taskType,
    trusteeId: task.trusteeId,
    courtId: task.courtId,
    ...(courtName ? { courtName } : {}),
    divisionCode: task.divisionCode,
    ...(division ? { courtDivisionName: division.courtDivisionName } : {}),
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
