/**
 * Trustee-match-verification variant and fingerprint for seed data.
 *
 * Copies buildVariant and computeFingerprint from
 * backend/lib/use-cases/dataflows/trustee-variant.helpers.ts so seed data carries the same
 * variant and fingerprint the DXTR sync writes. Like production, fields are hashed raw: no trim,
 * no whitespace collapse, no case-fold.
 *
 * MAINTENANCE: dev-tools cannot import from backend (backend is CommonJS, dev-tools is ESM, and
 * backend lies outside dev-tools' rootDir). If backend's variant or fingerprint logic changes,
 * update this file and the backend-computed digest pinned in compute-fingerprint.test.ts.
 */

import { createHash } from 'node:crypto';
import type { DxtrTrusteeParty } from '@common/cams/dataflow-events.js';

function rawField(value: string | undefined): string {
  return value ?? '';
}

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

export function computeFingerprint(variant: string): string {
  return createHash('sha256').update(variant).digest('hex');
}
