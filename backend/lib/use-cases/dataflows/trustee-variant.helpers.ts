import { createHash } from 'node:crypto';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';

/**
 * Substitutes '' for an absent field so the variant's shape (key set) never changes based on
 * which optional DXTR fields happened to be present — JSON.stringify otherwise omits
 * undefined-valued keys entirely. Anything actually present passes through byte-for-byte: no
 * trim, no whitespace collapse, no case-fold. Fingerprints must reflect demographics exactly as
 * DXTR rendered them, because normalization rules can change over time — if the variant folded
 * rendering differences, a later change to those rules would silently invalidate every fingerprint
 * already stored in TRUSTEE_VARIATION.
 */
function rawField(value: string | undefined): string {
  return value ?? '';
}

/**
 * Builds the "variant" — the raw demographic string identifying one DXTR trustee-party record
 * for one sync event, exactly as DXTR rendered it. Two events produce the same variant (and
 * therefore the same fingerprint) only when every relevant field is byte-for-byte identical.
 * Deliberately NOT case- or whitespace-normalized: see rawField.
 */
export function buildVariant(dxtrTrustee: DxtrTrusteeParty): string {
  const shape = {
    firstName: rawField(dxtrTrustee.firstName),
    middleName: rawField(dxtrTrustee.middleName),
    lastName: rawField(dxtrTrustee.lastName),
    generation: rawField(dxtrTrustee.generation),
    address1: rawField(dxtrTrustee.legacy?.address1),
    address2: rawField(dxtrTrustee.legacy?.address2),
    address3: rawField(dxtrTrustee.legacy?.address3),
    cityStateZipCountry: rawField(dxtrTrustee.legacy?.cityStateZipCountry),
    phone: rawField(dxtrTrustee.legacy?.phone),
    fax: rawField(dxtrTrustee.legacy?.fax),
    email: rawField(dxtrTrustee.legacy?.email),
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
