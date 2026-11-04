import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import {
  IdentityMismatchReason,
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchSource,
  TrusteeMatchVerification,
} from '@common/cams/trustee-match-verification';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { TrusteeMatchVerificationRepository } from '../gateways.types';
import { TrusteeSerializedState } from './trustee-match-pipeline';

export type UpsertIdentityTaskInput = {
  source: TrusteeMatchSource;
  sourceTrustee: CanonicalTrusteeSource;
  mismatchReason: IdentityMismatchReason;
  findings: TrusteeSerializedState;
  fingerprint: string;
  variant: string;
  acmsProfessionalId?: string;
  caseId?: string;
  courtId?: string;
  appointedDate?: string;
};

/**
 * Finds the exact-variant match within an already-fetched fingerprint bucket. A fingerprint
 * (sha256 digest) is never trusted as a unique key on its own — a bucket can hold more than one
 * document, so every lookup must verify by comparing the full variant string for exact equality
 * ("bucket+verify").
 */
export function findByVariant<T extends { variant: string }>(
  bucket: T[],
  variant: string,
): T | undefined {
  return bucket.find((v) => v.variant === variant);
}

/**
 * Looks up a fingerprint's TrusteeMatchVerification bucket and verifies by variant (see
 * findByVariant).
 */
async function findVerificationBucketEntry(
  verificationRepo: TrusteeMatchVerificationRepository,
  fingerprint: string,
  variant: string,
): Promise<TrusteeMatchVerification | null> {
  const bucket = await verificationRepo.findByFingerprint(fingerprint);
  return findByVariant(bucket, variant) ?? null;
}

/**
 * Writes a TrusteeMatchVerification identity task for an unresolved (ambiguous or no-match)
 * pipeline outcome, from either legacy source (ACMS or DXTR), unless a task already exists for
 * the same fingerprint and variant. An existing task is never modified, whatever its source:
 * the fingerprint and variant exist for future matching, so the existing record stands. Returns
 * true when the existing task has already been resolved or dismissed, which callers report as a
 * re-verification for match accuracy tracking. Omits caseId/courtId/appointedDate when undefined
 * rather than persisting them — a caseless (e.g. ACMS-sourced) task has none of these.
 *
 * The existing-task check and the write are not atomic, so under concurrent writers the returned
 * flag is best-effort telemetry: a task created or resolved between the check and the write can be
 * reported as pending. The repository's unique index prevents duplicates.
 */
export async function upsertIdentityTask(
  verificationRepo: TrusteeMatchVerificationRepository,
  input: UpsertIdentityTaskInput,
): Promise<boolean> {
  const { fingerprint, variant } = input;
  const existing = await findVerificationBucketEntry(verificationRepo, fingerprint, variant);
  if (existing) {
    return existing.status !== 'pending';
  }
  const doc = createAuditRecord<TrusteeMatchVerification>(
    {
      documentType: TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
      caseId: input.caseId,
      courtId: input.courtId,
      sourceTrustee: input.sourceTrustee,
      mismatchReason: input.mismatchReason,
      source: input.source,
      findings: input.findings,
      appointedDate: input.appointedDate,
      acmsProfessionalId: input.acmsProfessionalId,
      taskType: 'trustee-match',
      status: 'pending',
      taskDate: new Date().toISOString(),
      fingerprint,
      variant,
    },
    SYSTEM_USER_REFERENCE,
  );
  await verificationRepo.upsertVerification(doc);
  return false;
}
