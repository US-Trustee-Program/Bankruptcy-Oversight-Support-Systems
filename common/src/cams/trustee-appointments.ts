import { Auditable } from './auditable';
import { Identifiable } from './document';
import { ChapterType } from './trustees';

type AppointmentStatus = 'active' | 'inactive';

export type TrusteeAppointmentInput = {
  chapter: ChapterType;
  courtId: string;
  divisionCode: string;
  appointedDate: string;
  status: AppointmentStatus;
  effectiveDate: string;
};

export type TrusteeAppointment = Auditable &
  Identifiable & {
    trusteeId: string;
    chapter: ChapterType;
    courtId: string;
    divisionCode: string;
    appointedDate: string;
    status: AppointmentStatus;
    effectiveDate: string;
    courtName?: string;
    courtDivisionName?: string;
  };
