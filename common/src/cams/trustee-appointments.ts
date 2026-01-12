import { Auditable } from './auditable';
import { Identifiable } from './document';
import { AppointmentType, ChapterType, AppointmentStatus } from './types/Appointments';

const chapter7AppointmentTypes: readonly AppointmentType[] = [
  'panel',
  'off-panel',
  'elected',
  'converted-case',
];
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

export function formatAppointmentStatus(status: AppointmentStatus): string {
  const statusLabels: Record<AppointmentStatus, string> = {
    active: 'Active',
    inactive: 'Inactive',
    'voluntary-suspended': 'Voluntary Suspended',
    'involuntary-suspended': 'Involuntary Suspended',
    deceased: 'Deceased',
    resigned: 'Resigned',
    terminated: 'Terminated',
    removed: 'Removed',
  };

  return statusLabels[status];
}

export function getStatusOptions(
  chapter: ChapterType,
  appointmentType: AppointmentType,
): readonly AppointmentStatus[] {
  // Chapter 7
  if (chapter === '7') {
    if (appointmentType === 'panel') {
      return ['active', 'voluntary-suspended', 'involuntary-suspended'];
    }
    if (appointmentType === 'off-panel') {
      return ['deceased', 'resigned', 'terminated'];
    }
    if (appointmentType === 'elected' || appointmentType === 'converted-case') {
      return ['active', 'inactive'];
    }
  }

  // Chapter 11
  if (chapter === '11' && appointmentType === 'case-by-case') {
    return ['active', 'inactive'];
  }

  // Chapter 11 Subchapter V
  if (chapter === '11-subchapter-v') {
    if (appointmentType === 'pool') {
      return ['active'];
    }
    if (appointmentType === 'out-of-pool') {
      return ['deceased', 'removed', 'resigned'];
    }
  }

  // Chapter 12
  if (chapter === '12') {
    if (appointmentType === 'standing') {
      return ['active', 'deceased', 'resigned', 'terminated'];
    }
    if (appointmentType === 'case-by-case') {
      return ['active', 'inactive'];
    }
  }

  // Chapter 13
  if (chapter === '13') {
    if (appointmentType === 'standing') {
      return ['active', 'deceased', 'resigned', 'terminated'];
    }
    if (appointmentType === 'case-by-case') {
      return ['active', 'inactive'];
    }
  }

  // Default fallback
  return ['active', 'inactive'];
}

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
