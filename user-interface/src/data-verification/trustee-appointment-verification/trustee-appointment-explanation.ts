import { AppointmentTaskReason } from '@common/cams/trustee-appointment-verification';

/**
 * The reason sentence for a Trustee Appointment task, split around the trustee's name so the
 * caller can render it as a link (e.g. NewTabLink) in place rather than as plain text.
 */
export type AppointmentTaskReasonParts = {
  before: string;
  after: string;
};

export function buildAppointmentTaskReasonParts(
  reason: AppointmentTaskReason,
): AppointmentTaskReasonParts {
  if (reason === 'appointment-inactive') {
    return {
      before: 'The appointment for Trustee ',
      after: ' in this court, division and chapter is not active.',
    };
  }
  return {
    before: 'Trustee ',
    after: ' is not appointed in this court, division and chapter.',
  };
}

/** The top-of-screen success message after a refresh resolves an appointment task. */
export function buildRefreshResolvedMessage(trusteeName: string, caseCount: number): string {
  const cases = caseCount === 1 ? '1 case' : `${caseCount} cases`;
  return `Trustee ${trusteeName}'s appointment verified for ${cases}.`;
}

type CourtAndDivision = {
  courtId: string;
  courtName?: string;
  divisionCode: string;
  courtDivisionName?: string;
};

/**
 * "{court} ({division})" for an appointment task, falling back to the court id and division code
 * when the backend could not resolve their names.
 */
export function formatCourtAndDivision(task: CourtAndDivision): string {
  return `${task.courtName ?? task.courtId} (${task.courtDivisionName ?? task.divisionCode})`;
}

/** The warning after a refresh that still finds no covering appointment. */
export function buildRefreshStillUncoveredMessage(
  tuple: CourtAndDivision & { chapter: string },
): string {
  return `There's still no active Chapter ${tuple.chapter} appointment in ${formatCourtAndDivision(tuple)}. Ask a Trustee Admin to add or reactivate it, then try again.`;
}
