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
import { AppointmentTaskReason } from '@common/cams/trustee-appointment-verification';

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
  const { caseId, trusteeId, courtId, courtDivisionCode, chapter, documentType, checks } =
    appointment;
  if (
    documentType !== 'CASE_APPOINTMENT' ||
    !checks?.matchedCase ||
    !checks.matchedTrustee ||
    checks.matchedTrusteeAppointment ||
    !courtId ||
    !courtDivisionCode ||
    !chapter
  ) {
    return;
  }

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
