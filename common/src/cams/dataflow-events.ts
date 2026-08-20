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
 * Match-outcome vocabulary for trustee appointment sync. A name collision that resolves to a
 * clear scoring winner (score > FUZZY_MATCH_SCORE_THRESHOLD, gap >= FUZZY_MATCH_MIN_GAP,
 * isAppointmentMatch passes) is treated the same as any other resolved trusteeId and auto-linked
 * — it is never persisted here, since minimizing human review is the point of scoring in the
 * first place. Only genuinely unresolved outcomes reach this enum:
 *  - AmbiguousMatchUnresolved: the fuzzy-match attempt failed to find a clear winner (scored, no
 *    resolution). Persisted, countable, verification-triggering.
 *  - CandidateLoadFailed: matchTrusteeByName found more than one raw name candidate (so this is
 *    NOT "no trustee matched this name" — NoTrusteeMatch would be misleading here), but scoring
 *    could not load ANY of their trustee/appointment records (e.g. every candidate rejected with
 *    a non-transient error). Distinct from AmbiguousMatchUnresolved, which means scoring DID run
 *    and simply found no clear winner — conflating the two would make the Data Verification UI's
 *    "Multiple Match" label (gated on AmbiguousMatchUnresolved) appear next to zero candidates,
 *    which is its own kind of misleading. Still routed through the same
 *    upsertMatchVerification/writeSurrogateAppointment sequence for human review.
 */
export const TrusteeAppointmentSyncErrorCode = {
  // matchTrusteeByName found zero CAMS trustees with a name matching the DXTR trustee, and the
  // fuzzy-normalization fallback also found nothing — no candidate exists to review at all.
  NoTrusteeMatch: 'NO_TRUSTEE_MATCH',
  // The name resolved to exactly one CAMS trustee, but that trustee's data doesn't clear the
  // court+division+chapter appointment-match bar (isAppointmentMatch fails) — e.g. no
  // appointments at all, or only appointments that don't cover this case. One known candidate,
  // but not with enough confidence to auto-link, so a human reviews the single candidate.
  ImperfectMatch: 'IMPERFECT_MATCH',
  // matchTrusteeByName found more than one raw name-collision candidate, and scoring
  // (resolveNameCollisionByScoring) ran but found no clear winner (no candidate cleared the
  // score/gap threshold, or the winner's appointment doesn't cover this case's
  // court/division/chapter). Genuinely ambiguous — needs a human to pick among the candidates.
  AmbiguousMatchUnresolved: 'AMBIGUOUS_MATCH_UNRESOLVED',
  // The name resolved to exactly one CAMS trustee with an appointment that matches this case's
  // court/division/chapter, but that appointment's status isn't 'active' (e.g. suspended,
  // terminated, resigned, deceased) — otherwise a perfect match, so a human confirms the
  // trustee's current status is still correct before linking.
  PerfectMatchInactiveStatus: 'PERFECT_MATCH_INACTIVE_STATUS',
  // matchTrusteeByName found more than one raw name-collision candidate, but scoring could not
  // load ANY of their trustee/appointment records (e.g. every candidate rejected with a
  // non-transient error) — distinct from AmbiguousMatchUnresolved, which means scoring DID run
  // and simply found no clear winner. See the doc comment above this object for why conflating
  // the two would mislead the Data Verification UI's "Multiple Match" label.
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
