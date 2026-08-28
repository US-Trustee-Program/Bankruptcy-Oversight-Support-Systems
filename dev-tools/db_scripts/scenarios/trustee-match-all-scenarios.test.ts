import { describe, test, expect, vi } from 'vitest';
import type { SeedContext, SeedOperation } from '../../runner.js';
import { generate } from './trustee-match-all-scenarios.js';

function context(): SeedContext {
  return { generateCaseId: vi.fn() };
}

function findVerification(ops: SeedOperation[], id: string) {
  return ops
    .filter((o) => o.collectionOrTable === 'trustee-match-verification')
    .flatMap((o) => o.data)
    .find((d) => d.id === id);
}

function surrogatesFor(ops: SeedOperation[], collectionOrTable: string) {
  return ops.filter((o) => o.collectionOrTable === collectionOrTable).flatMap((o) => o.data);
}

// These cover only the CAMS-871 additions (multi-case mismatches) — the rest of this scenario
// file has no dedicated test coverage beyond the generic data-quality checks in
// all-scenarios.validation.test.ts.
describe('trustee-match-all-scenarios (CAMS-871 multi-case additions)', () => {
  test('pending multi-case mismatch: surrogates in both partitions share the verification fingerprint', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-multicase-091-99-86706');

    expect(verification).toBeDefined();
    expect(verification?.status).toBe('pending');
    expect(verification?.fingerprint).toBeTruthy();

    for (const table of ['case-trustee-appointments', 'trustee-case-appointments']) {
      const surrogates = surrogatesFor(ops, table);
      const forThisFingerprint = surrogates.filter(
        (s) => s.trusteeId === verification?.fingerprint,
      );
      expect(forThisFingerprint).toHaveLength(3);
      for (const surrogate of forThisFingerprint) {
        expect(surrogate.documentType).toBe('CASE_APPOINTMENT');
        expect(surrogate.isSurrogate).toBe(true);
        expect(surrogate.unassignedOn).toBeUndefined();
      }
      const caseIds = forThisFingerprint.map((s) => s.caseId).sort();
      expect(caseIds).toEqual(['091-99-86706', '091-99-98483', '091-99-99943']);
    }
  });

  test('already-approved mismatch has no surviving surrogate rows for its fingerprint', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-resolved-no-surrogates-091-99-97816');

    expect(verification).toBeDefined();
    expect(verification?.status).toBe('approved');
    expect(verification?.resolvedTrusteeId).toBeTruthy();
    expect(verification?.resolvedTrusteeName).toBeTruthy();

    for (const table of ['case-trustee-appointments', 'trustee-case-appointments']) {
      const surrogates = surrogatesFor(ops, table);
      const forThisFingerprint = surrogates.filter(
        (s) => s.trusteeId === verification?.fingerprint,
      );
      expect(forThisFingerprint).toHaveLength(0);
    }
  });

  test('already-approved multi-case mismatch has a populated resolvedCaseIds snapshot and no surviving surrogate rows', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-resolved-with-snapshot-091-99-86706');

    expect(verification).toBeDefined();
    expect(verification?.status).toBe('approved');
    expect(verification?.resolvedTrusteeId).toBeTruthy();
    expect(verification?.resolvedTrusteeName).toBeTruthy();
    expect([...((verification?.resolvedCaseIds as string[] | undefined) ?? [])].sort()).toEqual([
      '091-99-86706',
      '091-99-98483',
      '091-99-99943',
    ]);

    for (const table of ['case-trustee-appointments', 'trustee-case-appointments']) {
      const surrogates = surrogatesFor(ops, table);
      const forThisFingerprint = surrogates.filter(
        (s) => s.trusteeId === verification?.fingerprint,
      );
      expect(forThisFingerprint).toHaveLength(0);
    }
  });
});
