import { Auditable } from './auditable';
import { Identifiable } from './document';
import { AppointmentType, AppointmentChapterType, AppointmentStatus } from './trustees';
import { VALID, ValidatorFunction, ValidatorResult, ValidationSpec } from './validation';
import { CaseChapter } from './cases';

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

export function isChapter12Standing(
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
): boolean {
  return chapter === '12' && appointmentType === 'standing';
}

export function isChapter13Standing(
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
): boolean {
  return chapter === '13' && appointmentType === 'standing';
}

export function isChapter7Elected(
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
): boolean {
  return chapter === '7' && appointmentType === 'elected';
}

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
  divisionCode?: string; // Deprecated: kept for backward compatibility
  divisionCodes?: string[]; // New: array of division codes
  appointedDate: string;
  status: AppointmentStatus;
  effectiveDate: string;
  courtName?: string;
  courtDivisionName?: string;
};

export type TrusteeAppointment = Auditable &
  Identifiable & {
    trusteeId: string;
    chapter: AppointmentChapterType;
    appointmentType: AppointmentType;
    courtId: string;
    divisionCode?: string; // Deprecated: kept for backward compatibility
    divisionCodes?: string[]; // New: array of division codes
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

  // chapter is typed as the closed AppointmentChapterType union, but this validator runs
  // against untrusted input cast from an HTTP request body -- an unrecognized string value
  // would make this an undefined lookup. Defaults to an empty list (matching
  // getStatusOptions' existing guard below) so an out-of-range chapter fails validation
  // cleanly instead of throwing a TypeError.
  const validAppointmentTypes = chapterAppointmentTypeMap[chapter] ?? [];
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

const validateDivisionCodes: ValidatorFunction = (obj: unknown): ValidatorResult => {
  const appointment = obj as TrusteeAppointmentInput;
  const { divisionCode, divisionCodes } = appointment;

  // Filter out empty/falsy entries from divisionCodes
  const validDivisionCodes = divisionCodes?.filter((code) => !!code?.trim()) ?? [];

  const hasLegacyDivision = typeof divisionCode === 'string' && divisionCode.trim().length > 0;
  const hasNewDivision = validDivisionCodes.length > 0;

  // At least one non-empty division must be specified (either old or new format)
  if (!hasLegacyDivision && !hasNewDivision) {
    return {
      reasonMap: {
        $: {
          reasons: ['At least one division must be specified'],
        },
      },
    };
  }

  return VALID;
};

export const TRUSTEE_APPOINTMENTS_INTERNAL_SPEC: Readonly<ValidationSpec<TrusteeAppointmentInput>> =
  {
    $: [
      validateAppointmentTypeForChapter,
      validateStatusForChapterAndAppointmentType,
      validateDivisionCodes,
    ],
  };

/**
 * Resolves an appointment's division codes, falling back from the current `divisionCodes`
 * array to the deprecated singular `divisionCode` only when `divisionCodes` itself is absent
 * -- not merely empty, so an explicit empty array is never silently replaced by the legacy
 * field. Centralizes a fallback that was previously reimplemented inline at each call site.
 */
export function getDivisionCodes(appointment: {
  divisionCode?: string;
  divisionCodes?: string[];
}): string[] {
  return (appointment.divisionCodes ?? [appointment.divisionCode]).filter(Boolean) as string[];
}

/**
 * Find a merge target among a trustee's existing appointments. A merge target is an active
 * appointment with the same courtId, chapter, and appointmentType -- "duplicate" here means
 * same court+chapter+type, not requiring division overlap; merging is what reconciles
 * divisions (by union), not a check that they already overlap.
 *
 * Only applies when the incoming appointment itself is active: merging a non-active
 * create/update into an existing active appointment would silently overwrite that active
 * record's data with the incoming (non-active) values instead of leaving it alone, which is
 * never the intent of a status-changing create/update.
 *
 * Shared between the frontend form (pre-merge UX feedback before ever calling the API) and
 * the backend (the authoritative enforcement point for direct API callers and for update,
 * which the frontend does not check at all). Keeping this in one place means both can never
 * drift into disagreeing about what counts as a duplicate.
 */
export function findMergeTarget(
  courtId: string,
  chapter: AppointmentChapterType,
  appointmentType: AppointmentType,
  incomingStatus: AppointmentStatus,
  existingAppointments: TrusteeAppointment[],
): TrusteeAppointment | undefined {
  if (incomingStatus !== 'active') {
    return undefined;
  }
  return existingAppointments.find(
    (appt) =>
      appt.courtId === courtId &&
      appt.chapter === chapter &&
      appt.appointmentType === appointmentType &&
      appt.status === 'active',
  );
}

export type MergedPayloadResult = {
  type: 'merged';
  targetId: string;
  payload: TrusteeAppointmentInput;
  addedDivisionCodes: string[];
};

export type MergePayloadResult = MergedPayloadResult | { type: 'created' };

/**
 * Computes the merged payload for a duplicate appointment (union of division codes), or
 * signals that no merge applies. Only the division fields are computed from `payload`;
 * every other field in the returned payload is mergeTarget's own, so the redirected
 * submission's appointedDate/status/effectiveDate/courtName/courtDivisionName can never
 * overwrite the pre-existing target record. Deliberately returns division *codes* only, not
 * human-readable division *names* -- name resolution needs a district's full division list
 * (getDivisionsForDistrict), which is a frontend-only concern with no equivalent need on the
 * backend. Frontend callers wrap this to add display names on top; see
 * user-interface/src/trustees/forms/appointmentMergeHelpers.ts.
 */
// Overloaded so a caller that already knows it has a defined mergeTarget (e.g. inside its own
// `if (mergeTarget)` check) gets the narrowed MergedPayloadResult type directly, rather than
// needing a second, structurally-unreachable `if (result.type === 'merged')` check purely to
// satisfy the discriminated union -- see backend/lib/use-cases/trustee-appointments.ts's
// createAppointment/updateAppointment for that call pattern.
export function buildMergePayload(
  mergeTarget: TrusteeAppointment,
  payload: TrusteeAppointmentInput,
): MergedPayloadResult;
export function buildMergePayload(
  mergeTarget: TrusteeAppointment | undefined,
  payload: TrusteeAppointmentInput,
): MergePayloadResult;
export function buildMergePayload(
  mergeTarget: TrusteeAppointment | undefined,
  payload: TrusteeAppointmentInput,
): MergePayloadResult {
  if (!mergeTarget) {
    return { type: 'created' };
  }

  const existingDivisions = getDivisionCodes(mergeTarget);
  const mergedDivisions = [...new Set([...existingDivisions, ...(payload.divisionCodes ?? [])])];
  const addedDivisionCodes = (payload.divisionCodes ?? []).filter(
    (code) => !existingDivisions.includes(code),
  );

  return {
    type: 'merged',
    targetId: mergeTarget.id,
    // Only the division fields are computed from the incoming payload (that's the whole
    // point of a merge); every other field comes from mergeTarget itself, not `payload`,
    // so a duplicate-merge can never clobber the target's own appointedDate/status/
    // effectiveDate/courtName/courtDivisionName with the redirected submission's values.
    payload: {
      chapter: mergeTarget.chapter,
      appointmentType: mergeTarget.appointmentType,
      courtId: mergeTarget.courtId,
      courtName: mergeTarget.courtName,
      courtDivisionName: mergeTarget.courtDivisionName,
      appointedDate: mergeTarget.appointedDate,
      status: mergeTarget.status,
      effectiveDate: mergeTarget.effectiveDate,
      divisionCodes: mergedDivisions,
      divisionCode: mergedDivisions[0],
    },
    addedDivisionCodes,
  };
}

export type CaseAppointmentInput = {
  caseId: string;
  trusteeId: string;
  assignedOn: string;
  appointedDate?: string;
  unassignedOn?: string;
  dateFiled?: string;
  chapter?: CaseChapter;
  courtDivisionCode?: string;
  closedDate?: string;
  reopenedDate?: string;
  isSurrogate?: boolean;
  variant?: string;
};

export type CaseAppointment = Auditable &
  Identifiable & {
    caseId: string;
    trusteeId: string;
    assignedOn: string;
    appointedDate?: string;
    unassignedOn?: string;
    dateFiled?: string;
    chapter?: CaseChapter;
    courtDivisionCode?: string;
    closedDate?: string;
    reopenedDate?: string;
    caseStatus?: 'OPEN' | 'CLOSED';
    isSurrogate?: boolean;
    variant?: string;
  };

export type CaseTrusteeAppointmentHistoryItem = CaseAppointment & {
  trusteeName?: string;
};

export type CaseTrusteeAppointmentHistory = {
  current: CaseAppointment | null;
  history: CaseTrusteeAppointmentHistoryItem[];
};

export type TrusteeCaseListItem = {
  caseId: string;
  courtDivisionName: string;
  caseTitle: string;
  chapter: CaseChapter;
  dateFiled: string;
  appointedDate?: string;
  caseStatus: 'OPEN' | 'CLOSED';
};

export type CaseDenormalizedFields = {
  dateFiled: string;
  caseStatus: 'OPEN' | 'CLOSED';
  chapter: CaseChapter;
  courtDivisionCode: string;
};
