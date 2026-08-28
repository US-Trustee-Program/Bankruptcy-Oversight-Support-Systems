import { Auditable } from './auditable';
import {
  CandidateScore,
  DxtrTrusteeParty,
  TrusteeAppointmentSyncErrorCode,
} from './dataflow-events';
import { OrderStatus } from './orders';
import { AppointmentStatus } from './trustees';

export const TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE = 'TRUSTEE_MATCH_VERIFICATION' as const;

export type TrusteeMatchVerification = Auditable & {
  id: string;
  documentType: 'TRUSTEE_MATCH_VERIFICATION';
  /**
   * The case that first created this fingerprint's verification document
   * (informational/display continuity only) — NOT the source of truth for which cases this
   * mismatch affects. The write path never updates caseId on an existing document, so this
   * is the originating case, not the most recent one. This document is keyed by
   * fingerprint/variant, so one document can represent many cases; while pending, case
   * membership is answered by querying trustee-case-appointments for trusteeId =
   * <fingerprint> (the surrogate rows written while the mismatch is pending) — never from
   * caseId. Once approved, the surrogate rows are gone (remap deletes them), so case
   * membership comes from the resolvedCaseIds snapshot below instead.
   */
  caseId: string;
  courtId: string;
  dxtrTrustee: DxtrTrusteeParty;
  /**
   * The ACMS professional ID this event's DXTR record maps to, formatted
   * "{GROUP_DESIGNATOR}-{PROF_CODE}" (e.g. "NY-00123") — informational/diagnostic only, never
   * used to pick or auto-link a trustee (see isSentinelWithNoIdentity in
   * sync-trustee-case-appointments.ts, which keys off the underlying raw profCode, not this
   * formatted field). Omitted (not persisted) when the underlying profCode is a known sentinel
   * value ("00000"/"99999") — a formatted sentinel ID would read as a real professional ID to a
   * reviewer rather than the "no trustee appointed"/"ID unavailable" placeholder it actually is.
   * Lets a reviewer distinguish a genuine unmatched trustee from a sentinel-coded placeholder
   * without needing to cross-reference DXTR directly.
   */
  acmsProfessionalId?: string;
  mismatchReason?: TrusteeAppointmentSyncErrorCode;
  matchCandidates: CandidateScore[];
  status: OrderStatus;
  resolvedTrusteeId?: string;
  resolvedTrusteeName?: string;
  /** Case IDs snapshotted at approval, since live derivation returns nothing once remap runs. */
  resolvedCaseIds?: string[];
  courtName?: string;
  taskType: 'trustee-match';
  reason?: string;
  inactiveAppointmentStatus?: AppointmentStatus;
  taskDate?: string | Date;
  /**
   * The court's actual appointment date, carried from the source DXTR event's
   * appointedDate. Distinct from the approval timestamp used for assignedOn.
   */
  appointedDate?: string;
  /** sha256(variant) — the bucket key used to find this document. See variant below. */
  fingerprint: string;
  /**
   * The canonicalized (not raw) demographic variant string this document was created from —
   * buildVariant trims, collapses internal whitespace, and lowercases every field (see design
   * Decision 2). Any change to buildVariant/normalizeField silently invalidates every stored
   * variant, so TRUSTEE_VARIATION and pending verification buckets go cold on future events —
   * an accepted cost, not a bug.
   */
  variant: string;
};

/**
 * The projected shape returned by repository.search(). Auditable fields
 * (createdOn, createdBy, updatedOn, updatedBy) are excluded by the MongoDB
 * projection; matchCandidates is retained so the use-case can compute
 * candidateCount and preselectedCandidate before stripping it.
 */
export type TrusteeMatchVerificationSearchResult = Omit<TrusteeMatchVerification, keyof Auditable>;

export type TrusteeCandidate = { trusteeId: string; trusteeName: string };

export type TrusteeMatchVerificationListItem = Pick<
  TrusteeMatchVerification,
  | 'id'
  | 'documentType'
  | 'caseId'
  | 'courtId'
  | 'courtName'
  | 'dxtrTrustee'
  | 'mismatchReason'
  | 'status'
  | 'resolvedTrusteeId'
  | 'resolvedTrusteeName'
  | 'taskType'
  | 'taskDate'
  | 'reason'
  | 'inactiveAppointmentStatus'
> & {
  preselectedCandidate: TrusteeCandidate | null;
  candidateCount: number;
  affectedCaseCount: number;
};

export type EnrichedTrusteeMatchVerification = TrusteeMatchVerification & {
  affectedCaseIds: string[];
};
