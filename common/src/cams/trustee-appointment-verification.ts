import { Auditable } from './auditable';
import { OrderStatus } from './orders';

export const TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE =
  'TRUSTEE_APPOINTMENT_VERIFICATION' as const;

/**
 * Why a trustee's case appointment is not covered: the trustee has no appointment at all for the
 * case's court, division and chapter ('no-appointment'), or has one but it is not active
 * ('appointment-inactive').
 */
export type AppointmentTaskReason = 'no-appointment' | 'appointment-inactive';

/** The tuple that identifies one appointment task. One task per tuple, joined by many cases. */
export type AppointmentTaskKey = {
  trusteeId: string;
  courtId: string;
  divisionCode: string;
  chapter: string;
};

/**
 * A "Trustee Appointment" data-verification task (CAMS-956): one or more cases were assigned to a
 * trustee whose appointments don't include an active one for the cases' court, division and
 * chapter. Keyed by (trusteeId, courtId, divisionCode, chapter); each further uncovered case for
 * the same tuple joins caseIds instead of opening a second task.
 */
export type TrusteeAppointmentVerification = Auditable &
  AppointmentTaskKey & {
    id: string;
    documentType: typeof TRUSTEE_APPOINTMENT_VERIFICATION_DOCUMENT_TYPE;
    taskType: 'trustee-appointment';
    /** Latest write wins: describes the trustee's state for this tuple as of the last join. */
    reason: AppointmentTaskReason;
    caseIds: string[];
    status: OrderStatus;
  };

/**
 * One appointment task as the Data Verification queue lists it. Court and division names are
 * resolved by the backend when known; the UI falls back to courtId/divisionCode. taskDate is when
 * the task was opened (createdOn), the sort key every queue row shares.
 */
export type TrusteeAppointmentVerificationListItem = Pick<
  TrusteeAppointmentVerification,
  | 'id'
  | 'documentType'
  | 'taskType'
  | 'trusteeId'
  | 'courtId'
  | 'divisionCode'
  | 'chapter'
  | 'reason'
  | 'status'
> & {
  courtName?: string;
  courtDivisionName?: string;
  taskDate: string;
  caseCount: number;
};
