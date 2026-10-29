import { describe, test, expect } from 'vitest';
import type { DxtrTrusteeParty } from '@common/cams/dataflow-events.js';
import { buildVariant, computeFingerprint } from './compute-fingerprint.js';

const messyTrustee = {
  firstName: '  Samuel ',
  lastName: 'Seedtrustee',
  legacy: { address1: '123  Main St', email: 'S@X.com' },
} as DxtrTrusteeParty;

describe('buildVariant', () => {
  test('passes fields through raw, substituting empty strings for absent ones', () => {
    expect(buildVariant(messyTrustee)).toBe(
      '{"firstName":"  Samuel ","middleName":"","lastName":"Seedtrustee","generation":"",' +
        '"address1":"123  Main St","address2":"","address3":"","cityStateZipCountry":"",' +
        '"phone":"","fax":"","email":"S@X.com"}',
    );
  });
});

describe('computeFingerprint', () => {
  test('matches the digest the backend computes for the same un-normalized trustee', () => {
    // Produced by backend/lib/use-cases/dataflows/trustee-variant.helpers.ts for messyTrustee.
    // Case and whitespace are preserved, so a normalizing port would produce a different digest.
    expect(computeFingerprint(buildVariant(messyTrustee))).toBe(
      '8d1cbda98a88768f16d5f89d883fb9b42036d18bfa5d7928743039c0be8e79b0', // pragma: allowlist secret
    );
  });
});
