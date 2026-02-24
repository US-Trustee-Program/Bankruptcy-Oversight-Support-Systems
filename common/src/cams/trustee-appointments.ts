import { Auditable } from './auditable';
import { Identifiable } from './document';
import { AppointmentType, AppointmentChapterType, AppointmentStatus } from './trustees';
import { VALID, ValidatorFunction, ValidatorResult, ValidationSpec } from './validation';

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

export const chapterAppointmentTypeMap: Record<AppointmentChapterType, readonly AppointmentType[]> =
  {
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
    'voluntarily-suspended': 'Voluntarily Suspended',
    'involuntarily-suspended': 'Involuntarily Suspended',
    deceased: 'Deceased',
    resigned: 'Resigned',
    terminated: 'Terminated',
    removed: 'Removed',
  };

  return statusLabels[status];
}

const statusOptionsConfig: Record<
  AppointmentChapterType,
  Partial<Record<AppointmentType, readonly AppointmentStatus[]>>
> = {
  '7': {
    panel: ['active', 'voluntarily-suspended', 'involuntarily-suspended'],
    'off-panel': ['deceased', 'resigned', 'terminated'],
    elected: ['active', 'inactive'],
    'converted-case': ['active', 'inactive'],
  },
  '11': {
    'case-by-case': ['active', 'inactive'],
  },
  '11-subchapter-v': {
    pool: ['active'],
    'out-of-pool': ['deceased', 'removed', 'resigned'],
  },
  '12': {
    standing: ['active', 'deceased', 'resigned', 'terminated'],
    'case-by-case': ['active', 'inactive'],
  },
  '13': {
    standing: ['active', 'deceased', 'resigned', 'terminated'],
    'case-by-case': ['active', 'inactive'],
  },
};

export function getStatusOptions(
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
): readonly AppointmentStatus[] {
  const defaultStatusOptions: AppointmentStatus[] = ['active', 'inactive'];
  if (!statusOptionsConfig[chapter]) return defaultStatusOptions;
  return statusOptionsConfig[chapter][appointmentType] || defaultStatusOptions;
}

export type TrusteeAppointmentInput = {
  chapter: AppointmentChapterType;
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
    chapter: AppointmentChapterType;
    appointmentType: AppointmentType;
    courtId: string;
    divisionCode: string;
    appointedDate: string;
    status: AppointmentStatus;
    effectiveDate: string;
    courtName?: string;
    courtDivisionName?: string;
  };

const validateAppointmentTypeForChapter: ValidatorFunction = (obj: unknown): ValidatorResult => {
  const appointment = obj as TrusteeAppointmentInput;
  const { chapter, appointmentType } = appointment;

  if (!chapter || !appointmentType) {
    return VALID;
  }

  const validAppointmentTypes = chapterAppointmentTypeMap[chapter];
  if (!validAppointmentTypes.includes(appointmentType)) {
    return {
      reasonMap: {
        $: {
          reasons: [`Appointment type "${appointmentType}" is not valid for chapter ${chapter}`],
        },
      },
    };
  }

  return VALID;
};

const validateStatusForChapterAndAppointmentType: ValidatorFunction = (
  obj: unknown,
): ValidatorResult => {
  const appointment = obj as TrusteeAppointmentInput;
  const { chapter, appointmentType, status } = appointment;

  if (!chapter || !appointmentType || !status) {
    return VALID;
  }

  const validStatuses = getStatusOptions(chapter, appointmentType);
  if (!validStatuses.includes(status)) {
    return {
      reasonMap: {
        $: {
          reasons: [
            `Status "${status}" is not valid for chapter ${chapter} with appointment type "${appointmentType}"`,
          ],
        },
      },
    };
  }

  return VALID;
};

export const TRUSTEE_APPOINTMENTS_INTERNAL_SPEC: Readonly<ValidationSpec<TrusteeAppointmentInput>> =
  {
    $: [validateAppointmentTypeForChapter, validateStatusForChapterAndAppointmentType],
  };

export type CaseAppointment = Auditable & {
  id?: string;
  documentType: 'CASE_APPOINTMENT';
  caseId: string;
  trusteeId: string;
  assignedOn: string;
  unassignedOn?: string;
};
