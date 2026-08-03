import { createHash } from 'node:crypto';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';

/**
 * Trims, collapses internal whitespace runs to a single space, and case-folds a field
 * value. This is the entirety of variant normalization — no punctuation stripping, no
 * field reordering, no abbreviation expansion. See trustee-mismatch-fixes.slice-5-design.md
 * ("Decision 3") for why the scope stops here.
 */
function normalizeField(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Recursively sorts object keys so JSON.stringify produces the same output regardless of
 * property insertion order. Guards structured serialization against key-order drift, not
 * against the encoding ambiguity of naive delimiter-joining (see hashing-design companion
 * doc's "Serialization Ambiguity" section).
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
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
  return JSON.stringify(sortKeysDeep(shape));
}

/**
 * The persistent identity key used for TRUSTEE_VARIATION lookups: sha256(variant). See
 * trustee-mismatch-fixes.slice-5-hashing-design.md for why a plain full-length SHA-256
 * digest (no salt, no dual-hash) is sufficient here.
 */
export function computeFingerprint(variant: string): string {
  return createHash('sha256').update(variant).digest('hex');
}
