import { CaseAssignment } from './assignments';
import { DxtrCase } from './cases';
import { LegacyAddress } from './parties';

/**
 * Event triggered when trial attorney assignments change (add/remove).
 * Processed by dataflows to maintain office assignee records.
 */
export type CaseAssignmentEvent = CaseAssignment;

/**
 * Event triggered when a case is closed.
 * Processed by dataflows to remove all office assignee records for the case.
 */
export type CaseClosedEvent = {
  caseId: string;
};

/**
 * Event triggered to reload/sync a case from DXTR.
 * Processed by dataflows to update case data in MongoDB.
 */
export type CaseSyncEvent = {
  type: 'CASE_CHANGED' | 'MIGRATION';
  caseId: string;
  bCase?: DxtrCase;
  error?: unknown;
  retryCount?: number;
};

/**
 * Trustee party data from DXTR AO_PY table.
 * Used during trustee appointment sync to match against CAMS trustees.
 */
export type DxtrTrusteeParty = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  generation?: string;
  fullName: string;
  legacy?: LegacyAddress & {
    phone?: string;
    fax?: string;
    email?: string;
  };
};

/**
 * Event triggered when a trustee appointment is detected in DXTR.
 * Processed by sync-trustee-appointments dataflow to match and link trustees to cases.
 */
export type TrusteeAppointmentSyncEvent = {
  caseId: string;
  courtId: string;
  dxtrTrustee: DxtrTrusteeParty;
  error?: unknown;
  retryCount?: number;
};

export type TrusteeAppointmentSyncErrorCode =
  | 'NO_TRUSTEE_MATCH'
  | 'MULTIPLE_TRUSTEES_MATCH'
  | 'CASE_NOT_FOUND';

/**
 * Sentinel value indicating a candidate trustee has not been scored yet.
 * Used when candidates are identified but fuzzy matching has not been performed.
 */
export const UNSCORED = -1;

/**
 * Scoring details for a candidate trustee during fuzzy matching.
 * Used to aid manual resolution when fuzzy matching cannot determine a clear winner.
 */
export type CandidateScore = {
  trusteeId: string;
  trusteeName: string;
  totalScore: number;
  addressScore: number;
  districtDivisionScore: number;
  chapterScore: number;
};

/**
 * Sent to the DLQ when a trustee appointment cannot be processed due to a known, permanent error.
 * Extends the original event to preserve full context for future recovery processing.
 */
export type TrusteeAppointmentSyncError = TrusteeAppointmentSyncEvent & {
  mismatchReason: TrusteeAppointmentSyncErrorCode;
  matchCandidates: CandidateScore[];
};

/**
 * Data shape for a MULTIPLE_TRUSTEES_MATCH error.
 */
export type MultipleTrusteesMatchErrorData = {
  mismatchReason: 'MULTIPLE_TRUSTEES_MATCH';
  matchCandidates: CandidateScore[];
};

/**
 * Type predicate to check if error data is a MULTIPLE_TRUSTEES_MATCH error.
 */
export function isMultipleTrusteesMatchError(
  data: unknown,
): data is MultipleTrusteesMatchErrorData {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const candidate = data as {
    mismatchReason?: unknown;
    matchCandidates?: unknown;
  };

  return (
    candidate.mismatchReason === 'MULTIPLE_TRUSTEES_MATCH' &&
    Array.isArray(candidate.matchCandidates)
  );
}
