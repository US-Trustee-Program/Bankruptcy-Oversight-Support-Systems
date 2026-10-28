import { CaseAssignment } from './assignments';
import { DxtrCase } from './cases';
import { LegacyAddress } from './parties';
import { TrusteeChangeSet } from './notifications';

/**
 * Event triggered when trial attorney assignments change (add/remove).
 * Processed by dataflows to maintain office assignee records.
 */
export type CaseAssignmentEvent = CaseAssignment;

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

export type TrusteeChangeNotificationEvent = {
  changeSet: TrusteeChangeSet;
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
 * The trustee-matching pipeline's source-record shape - a legacy-system trustee/professional
 * record, in whatever form it takes before matching normalizes it. DxtrTrusteeParty and
 * AcmsTrusteeProfessional are each their own nominal type sharing this shape, rather than aliases
 * of it directly, so DXTR's and ACMS's upstream schemas can diverge independently without forcing
 * a change here.
 */
export type CanonicalTrusteeSource = {
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
     * QC visibility into the parseCityStateZip result for this record's raw
     * cityStateZipCountry string. null means a raw string was present but did not match the
     * expected pattern; absent (undefined) means there was no raw string to parse. A parsed
     * state of null means a city and zip were recovered but no USPS state token was present.
     */
    parsedCityStateZip?: { city: string; state: string | null; zipCode: string } | null;
  };
};

/** Trustee party data from DXTR's AO_PY table. */
export type DxtrTrusteeParty = CanonicalTrusteeSource;

/** Trustee professional data from ACMS's CMMPR (Professional Master File) table. */
export type AcmsTrusteeProfessional = CanonicalTrusteeSource;

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
  profCode?: string;
  /**
   * Raw DXTR group designator (AO_CS.GRP_DES) for this record - one half of ACMS's compound
   * professional key (GROUP_DESIGNATOR + PROF_CODE, see /cams-gateways). A native DXTR/ACMS fact,
   * not yet the CAMS-formatted acmsProfessionalId string - that construction (and its
   * sentinel-suppression rule) belongs to the use-case layer that consumes this event, not the
   * gateway that surfaces the raw fields.
   */
  groupDesignator?: string;
};

/**
 * Wire value persisted for a soft-close write failure. Not a match outcome — it is a
 * post-resolution write-failure concern (the trustee was already resolved; persisting the new
 * appointment failed). Unresolved identity matches become identity tasks, never DLQ messages.
 */
export const SoftCloseWriteFailed = 'SOFT_CLOSE_WRITE_FAILED' as const;
export type SoftCloseWriteFailed = typeof SoftCloseWriteFailed;

/**
 * Sent to the DLQ when a trustee appointment cannot be processed due to a known, permanent error.
 * Extends the original event to preserve full context for future recovery processing.
 */
export type TrusteeAppointmentSyncError = TrusteeAppointmentSyncEvent & {
  mismatchReason: SoftCloseWriteFailed;
};

/**
 * Enqueued manually to start (or continue) heal-sentinel-case-appointments. Carries lastId, the
 * greatest _id seen in the previous page — a sentinel left unresolved this run (no mapping,
 * ambiguous mapping, missing acmsProfessionalId, or a permanent per-record failure) is left in
 * place rather than deleted, so a no-cursor re-query (unlike TrusteeVerificationRemapMessage's)
 * would keep re-fetching the same unresolvable leading page forever and never reach resolvable
 * sentinels further back in the collection. omit/null lastId starts from the beginning.
 */
export type HealSentinelCaseAppointmentsMessage = {
  lastId?: string | null;
  retryCount?: number;
  firstAttemptAt?: string;
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
