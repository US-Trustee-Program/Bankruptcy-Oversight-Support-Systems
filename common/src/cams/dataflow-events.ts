import { CaseAssignment } from './assignments';
import { DxtrCase } from './cases';
import { LegacyAddress } from './parties';
import { Address, PhoneNumber } from './contact';
import { TrusteeAppointment } from './trustee-appointments';

/**
 * Event triggered when trial attorney assignments change (add/remove).
 * Processed by dataflows to maintain office assignee records.
 */
export type CaseAssignmentEvent = CaseAssignment;

/**
 * CaseAssignmentEvent extended with ACMS integration fields for downstream consumers.
 * acmsProfessionalId carries the compound ACMS key ("{GROUP_DESIGNATOR}-{PROF_CODE}")
 * so the downstream handler needs no external lookups. null when unresolvable.
 */
export type CaseAssignmentDownstreamEvent = CaseAssignmentEvent & {
  acmsProfessionalId: string | null;
};

/**
 * Downstream event for trustee case appointments. Carries ACMS-native field values
 * so the downstream SQL handler requires no external lookups or translation.
 * APPT_TYPE is always 'TR' for trustee appointments and is hardcoded by the handler.
 */
export type TrusteeAppointmentDownstreamEvent = {
  caseId: string;
  trusteeId: string;
  acmsProfessionalId: string | null;
  assignedOn: string;
  appointedDate?: string;
  unassignedOn?: string;
  chapter: string;
};

/**
 * Enqueued by TrusteeMatchVerificationUseCase.approveVerification (one message per approval,
 * regardless of how many surrogate cases share the fingerprint). Processed asynchronously by
 * the trustee-verification-remap dataflow, which remaps every surrogate CaseAppointment
 * sharing this fingerprint to resolvedTrusteeId.
 */
export type TrusteeVerificationRemapMessage = {
  fingerprint: string;
  resolvedTrusteeId: string;
  resolvedTrusteeName?: string;
  verificationId: string;
  retryCount?: number;
  firstAttemptAt?: string;
};

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
export type OrphanedCaseMessage = {
  orphanedCaseId: string;
  currentCaseId: string;
};

export type CaseSyncEvent = {
  type: 'CASE_CHANGED' | 'MIGRATION';
  caseId: string;
  bCase?: DxtrCase;
  error?: unknown;
  retryCount?: number;
  divisionChange?: OrphanedCaseMessage;
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
    /**
     * Diagnostic field for QC visibility into the parseCityStateZip result for this
     * trustee's raw cityStateZipCountry string. null means a raw string was present but
     * did not match the expected pattern. Absent (undefined) when there was no raw
     * cityStateZipCountry string to parse in the first place.
     */
    parsedCityStateZip?: { city: string; state: string; zipCode: string } | null;
  };
};

/**
 * Event triggered when a trustee appointment is detected in DXTR.
 * Processed by sync-trustee-case-appointments dataflow to match and link trustees to cases.
 */
export type TrusteeAppointmentSyncEvent = {
  caseId: string;
  courtId: string;
  dxtrTrustee: DxtrTrusteeParty;
  appointedDate?: string;
  error?: unknown;
  retryCount?: number;
  chapter?: string;
  courtDivisionCode?: string;
  /**
   * Compound ACMS key ("{GROUP_DESIGNATOR}-{PROF_CODE}") extracted from the DXTR
   * transaction record (TX.REC) at the time the event was sourced. Undefined when
   * either component is missing from the source row.
   */
  acmsProfessionalId?: string;
};

/**
 * Match-outcome vocabulary for trustee appointment sync. `AmbiguousMatchUnresolved` and
 * `AmbiguousMatchResolved` are two named outcomes of the same disambiguation attempt (an
 * unscored name collision that always triggers a fuzzy-match attempt is not itself a member of
 * this enum — matchTrusteeByName signals it via the bare 'ambiguous' branch of its
 * NameMatchResult return value instead, since it is never persisted):
 *  - AmbiguousMatchUnresolved: the fuzzy-match attempt failed to find a clear winner (scored, no
 *    resolution). Persisted, countable, verification-triggering.
 *  - AmbiguousMatchResolved: the fuzzy-match attempt succeeded with a clear winner. Never
 *    auto-linked — always saved for human verification via the same
 *    upsertMatchVerification/writeSurrogateAppointment sequence as the failure outcome above,
 *    which is why this is grouped as a sibling of the same disambiguation attempt rather
 *    than kept as a separate confidence tier.
 *  - CandidateLoadFailed: matchTrusteeByName found more than one raw name candidate (so this is
 *    NOT "no trustee matched this name" — NoTrusteeMatch would be misleading here), but scoring
 *    could not load ANY of their trustee/appointment records (e.g. every candidate rejected with
 *    a non-transient error). Distinct from AmbiguousMatchUnresolved, which means scoring DID run
 *    and simply found no clear winner — conflating the two would make the Data Verification UI's
 *    "Multiple Match" label (gated on AmbiguousMatchUnresolved) appear next to zero candidates,
 *    which is its own kind of misleading. Still routed through the same
 *    upsertMatchVerification/writeSurrogateAppointment sequence for human review.
 * Each now has its own distinct wire value (AMBIGUOUS_MATCH_UNRESOLVED / AMBIGUOUS_MATCH_RESOLVED)
 * — no production data existed under the prior shared/misaligned names, so there was no
 * migration constraint blocking this realignment.
 */
export const TrusteeAppointmentSyncErrorCode = {
  NoTrusteeMatch: 'NO_TRUSTEE_MATCH',
  ImperfectMatch: 'IMPERFECT_MATCH',
  AmbiguousMatchResolved: 'AMBIGUOUS_MATCH_RESOLVED',
  AmbiguousMatchUnresolved: 'AMBIGUOUS_MATCH_UNRESOLVED',
  PerfectMatchInactiveStatus: 'PERFECT_MATCH_INACTIVE_STATUS',
  CandidateLoadFailed: 'CANDIDATE_LOAD_FAILED',
} as const;

export type TrusteeAppointmentSyncErrorCode =
  (typeof TrusteeAppointmentSyncErrorCode)[keyof typeof TrusteeAppointmentSyncErrorCode];

/**
 * Wire value persisted for a soft-close write failure. Not a match outcome — it is a
 * post-resolution write-failure concern (the trustee was already resolved; persisting the new
 * appointment failed) — so it is kept out of TrusteeAppointmentSyncErrorCode rather than
 * collapsed into the same enum as the match-outcome vocabulary above.
 */
export const SoftCloseWriteFailed = 'SOFT_CLOSE_WRITE_FAILED' as const;
export type SoftCloseWriteFailed = typeof SoftCloseWriteFailed;

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
  nameScore: number;
  phoneScore: number | null;
  emailScore: number | null;
  districtDivisionScore: number;
  chapterScore: number;
  address?: Address;
  phone?: PhoneNumber;
  email?: string;
  appointments?: TrusteeAppointment[];
};

/**
 * Sent to the DLQ when a trustee appointment cannot be processed due to a known, permanent error.
 * Extends the original event to preserve full context for future recovery processing.
 * mismatchReason additionally accepts SoftCloseWriteFailed (a post-resolution write-failure,
 * not a match outcome) since a soft-close failure is also reported via this same DLQ shape.
 */
export type TrusteeAppointmentSyncError = TrusteeAppointmentSyncEvent & {
  mismatchReason: TrusteeAppointmentSyncErrorCode | SoftCloseWriteFailed;
  matchCandidates: CandidateScore[];
};

/**
 * Event triggered to start trustee migration from ATS.
 * Supports optional flags for migration control.
 */
export type TrusteeMigrationStartEvent = {
  /**
   * If true, delete all existing trustees and appointments before starting migration.
   * Enables clean re-runs from scratch.
   */
  deleteAll?: boolean;
  /**
   * If true, reset migration state to start from beginning.
   * Useful for resuming failed migrations.
   */
  reset?: boolean;
  /**
   * Number of trustees to fetch per page from ATS.
   * Controls batch size for cursor-based pagination.
   * Default is typically 50-100.
   */
  pageSize?: number;
  /**
   * If true, import all trustees regardless of active appointment status.
   * Default behavior only imports trustees with active chapter appointments.
   */
  importAll?: boolean;
};
