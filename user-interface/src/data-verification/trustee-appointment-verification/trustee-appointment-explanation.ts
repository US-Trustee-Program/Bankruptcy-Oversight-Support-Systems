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
