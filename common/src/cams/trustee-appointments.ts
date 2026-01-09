import { Auditable } from './auditable';
import { Identifiable } from './document';
import { ChapterType, AppointmentType } from './trustees';

type AppointmentStatus = 'active' | 'inactive';

const chapter7AppointmentTypes: readonly AppointmentType[] = ['panel', 'off-panel'];
const chapter11AppointmentTypes: readonly AppointmentType[] = ['case-by-case'];
const chapter11SubchapterVAppointmentTypes: readonly AppointmentType[] = ['pool', 'out-of-pool'];
const chapter12AppointmentTypes: readonly AppointmentType[] = ['standing', 'case-by-case'];
const chapter13AppointmentTypes: readonly AppointmentType[] = ['standing', 'case-by-case'];

export const chapterAppointmentTypeMap: Record<ChapterType, readonly AppointmentType[]> = {
  '7': chapter7AppointmentTypes,
  '11': chapter11AppointmentTypes,
  '11-subchapter-v': chapter11SubchapterVAppointmentTypes,
  '12': chapter12AppointmentTypes,
  '13': chapter13AppointmentTypes,
};

export type TrusteeAppointmentInput = {
  chapter: ChapterType;
  appointmentType: AppointmentType;
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
    appointmentType: AppointmentType;
    courtId: string;
    divisionCode: string;
    appointedDate: string;
    status: AppointmentStatus;
    effectiveDate: string;
    courtName?: string;
    courtDivisionName?: string;
  };
