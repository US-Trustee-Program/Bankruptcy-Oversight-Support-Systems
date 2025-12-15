import { Auditable } from './auditable';
import { Identifiable } from './document';
import { ChapterType } from './trustees';

export type AppointmentStatus = 'active' | 'inactive';

export type TrusteeAppointment = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_APPOINTMENT';
    trusteeId: string;
    chapter: ChapterType;
    courtId: string; // District court ID (e.g., '0208' for S.D.N.Y.)
    divisionCode: string; // Division code (e.g., '081' for Manhattan)
    appointedDate: string; // ISO 8601 date string
    status: AppointmentStatus;
    effectiveDate: string; // ISO 8601 date string
  };
