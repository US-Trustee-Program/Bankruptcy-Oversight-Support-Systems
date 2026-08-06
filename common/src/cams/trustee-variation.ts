import { Auditable } from './auditable';
import { Identifiable } from './document';

export const TRUSTEE_VARIATION_DOCUMENT_TYPE = 'TRUSTEE_VARIATION' as const;

/**
 * Records that a specific demographic "variant" (see trustee-variant.helpers.ts) has been
 * resolved to a trusteeId. Written once per distinct variant ever encountered and never
 * rewritten, so a repeat sync event carrying the exact same DXTR demographic shape can
 * short-circuit straight to auto-link instead of re-running the matching/scoring pipeline.
 *
 * Bucket-keyed by fingerprint (non-unique): every lookup fetches the full bucket for a
 * fingerprint and verifies by comparing the stored `variant` for exact equality, rather than
 * trusting the fingerprint alone as a unique key. A fingerprint is a SHA-256 digest of the
 * variant; at realistic document volumes a true hash collision is astronomically unlikely,
 * but verifying against the stored variant closes that gap regardless — the same
 * defense-in-depth pattern a hash table uses to resolve bucket collisions.
 */
export type TrusteeVariation = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_VARIATION';
    fingerprint: string;
    variant: string;
    trusteeId: string;
  };
