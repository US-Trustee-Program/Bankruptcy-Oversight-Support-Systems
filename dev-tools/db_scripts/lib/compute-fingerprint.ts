/**
 * Trustee-match-verification fingerprint generator for seed data.
 *
 * Ports the normalize + sha256 logic directly from
 * backend/lib/use-cases/dataflows/trustee-variant.helpers.ts so seed data produces
 * identical fingerprints to the production algorithm.
 *
 * MAINTENANCE: This inline implementation is necessary because dev-tools cannot directly
 * import from backend due to TypeScript/ESM module resolution constraints. If backend's
 * fingerprint logic changes, update this file to match.
 */

import { createHash } from 'node:crypto';
import type { DxtrTrusteeParty } from '@common/cams/dataflow-events.js';

function normalizeField(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildVariant(dxtrTrustee: DxtrTrusteeParty): string {
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

export function computeFingerprint(dxtrTrustee: DxtrTrusteeParty): string {
  return createHash('sha256').update(buildVariant(dxtrTrustee)).digest('hex');
}
