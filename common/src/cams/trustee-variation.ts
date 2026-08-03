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
 * fingerprint and verifies by comparing the stored raw `variant` for exact equality, rather
 * than trusting the fingerprint alone as a unique key. See
 * trustee-mismatch-fixes.slice-5-hashing-design.md for the collision-risk rationale.
 */
export type TrusteeVariation = Auditable &
  Identifiable & {
    documentType: 'TRUSTEE_VARIATION';
    fingerprint: string;
    variant: string;
    trusteeId: string;
  };
