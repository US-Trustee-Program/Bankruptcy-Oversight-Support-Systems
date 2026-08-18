import { describe, test, expect } from 'vitest';
import { computeFingerprint } from './compute-fingerprint.js';

describe('computeFingerprint', () => {
  test('matches the known sha256 digest produced by production for a fixed input', () => {
    // Locks this dev-tools port to the real algorithm in
    // backend/lib/use-cases/dataflows/trustee-variant.helpers.ts — computed independently
    // via the same normalize+sha256 steps against this exact input.
    expect(
      computeFingerprint({
        firstName: 'Samuel',
        lastName: 'Seedtrustee',
        fullName: 'Samuel Seedtrustee',
      }),
    ).toBe('360859706c1d41be9bfc7e3fcb2fe917f57e147343a446c7b71c5bfbb754ebea');
  });

  test('normalizes case and whitespace so equivalent names produce the same fingerprint', () => {
    const canonical = computeFingerprint({
      firstName: 'Samuel',
      lastName: 'Seedtrustee',
      fullName: 'Samuel Seedtrustee',
    });
    const messy = computeFingerprint({
      firstName: '  SAMUEL  ',
      lastName: 'seedtrustee',
      fullName: 'irrelevant to the fingerprint',
    });

    expect(messy).toBe(canonical);
  });

  test('different demographic data produces a different fingerprint', () => {
    const a = computeFingerprint({ firstName: 'Samuel', lastName: 'Seedtrustee', fullName: 'x' });
    const b = computeFingerprint({ firstName: 'Diana', lastName: 'Seedtrustee', fullName: 'x' });

    expect(a).not.toBe(b);
  });

  test('legacy address fields are included in the fingerprint', () => {
    const withoutAddress = computeFingerprint({
      firstName: 'Samuel',
      lastName: 'Seedtrustee',
      fullName: 'x',
    });
    const withAddress = computeFingerprint({
      firstName: 'Samuel',
      lastName: 'Seedtrustee',
      fullName: 'x',
      legacy: { address1: '200 Trustee Ave' },
    });

    expect(withAddress).not.toBe(withoutAddress);
  });

  test('produces a 64-character hex sha256 digest', () => {
    const fingerprint = computeFingerprint({ firstName: 'A', lastName: 'B', fullName: 'A B' });
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});
