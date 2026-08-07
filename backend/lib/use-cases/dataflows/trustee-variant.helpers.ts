import { createHash } from 'node:crypto';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';

/**
 * Trims, collapses internal whitespace runs to a single space, and case-folds a field
 * value. This is the entirety of variant normalization — no punctuation stripping, no
 * field reordering, no abbreviation expansion. Scope stops here deliberately: this only
 * eliminates pure encoding noise (how a value is rendered, not what it says), rather than
 * making an interpretive equivalence judgment. Punctuation, field reordering, and
 * abbreviation expansion require the same kind of judgment Slices 1-4's name/address/phone
 * scoring already owns — folding that judgment into the variant would blur "identical record,
 * differently rendered" with "different record that might still be the same trustee."
 */
function normalizeField(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Builds the "variant" — the lightly-canonicalized demographic string identifying one DXTR
 * trustee-party record for one sync event. Two events whose relevant fields are identical
 * after normalization produce the same variant (and therefore the same fingerprint), even
 * if the raw DXTR record differed in whitespace or letter case.
 */
export function buildVariant(dxtrTrustee: DxtrTrusteeParty): string {
  const shape = {
    firstName: normalizeField(dxtrTrustee.firstName),
    middleName: normalizeField(dxtrTrustee.middleName),
    lastName: normalizeField(dxtrTrustee.lastName),
    generation: normalizeField(dxtrTrustee.generation),
    address1: normalizeField(dxtrTrustee.legacy?.address1),
    address2: normalizeField(dxtrTrustee.legacy?.address2),
    address3: normalizeField(dxtrTrustee.legacy?.address3),
    cityStateZipCountry: normalizeField(dxtrTrustee.legacy?.cityStateZipCountry),
    phone: normalizeField(dxtrTrustee.legacy?.phone),
    fax: normalizeField(dxtrTrustee.legacy?.fax),
    email: normalizeField(dxtrTrustee.legacy?.email),
  };
  return JSON.stringify(shape);
}

/**
 * The persistent identity key used for TRUSTEE_VARIATION lookups: sha256(variant). A
 * full-length digest with no salt or second hash algorithm is the same pattern git/npm/Docker
 * use for content-addressable identity — at this system's realistic volume (thousands to low
 * millions of documents), the birthday-bound collision probability is many orders of magnitude
 * below meaningless. Salting defends against a different threat model (rainbow tables against
 * secrets under adversarial attack) that doesn't apply to demographic records. Even in the
 * (already vanishing) event of a true hash collision, the bucket+verify lookup against the
 * stored variant (see TrusteeVariation/TrusteeMatchVerification) closes the gap.
 */
export function computeFingerprint(variant: string): string {
  return createHash('sha256').update(variant).digest('hex');
}
