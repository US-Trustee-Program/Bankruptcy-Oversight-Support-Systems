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

  test('pending division-mismatch multi-case mismatch: candidate covers two cases but not the third', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-divisionmismatch-091-99-40761');

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
        expect(surrogate.chapter).toBe('11');
      }
      const caseIds = forThisFingerprint.map((s) => s.caseId).sort();
      expect(caseIds).toEqual(['081-23-10005', '091-99-11079', '091-99-40761']);
      // The whole point of this fixture: two cases share one division, the third is in a
      // genuinely different court+division the candidate has no appointment for.
      const divisionsByCaseId = Object.fromEntries(
        forThisFingerprint.map((s) => [s.caseId, s.courtDivisionCode]),
      );
      expect(divisionsByCaseId['091-99-40761']).toBe('091');
      expect(divisionsByCaseId['091-99-11079']).toBe('091');
      expect(divisionsByCaseId['081-23-10005']).toBe('081');
    }

    const matchCandidates = verification?.matchCandidates as { trusteeId: string }[] | undefined;
    const candidateTrusteeId = matchCandidates?.[0]?.trusteeId;
    expect(candidateTrusteeId).toBe('seed-trustee-match-divisionmismatch');

    const appointments = ops
      .filter((o) => o.collectionOrTable === 'trustee-appointments')
      .flatMap((o) => o.data)
      .filter((a) => a.trusteeId === candidateTrusteeId);
    expect(appointments).toHaveLength(1);
    expect(appointments[0].courtId).toBe('0209');
    expect(appointments[0].divisionCodes).toEqual(['091']);
    expect(appointments[0].chapter).toBe('11');
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

  test('already-approved multi-case mismatch has a populated affectedCaseIds snapshot and no surviving surrogate rows', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-resolved-with-snapshot-091-99-86706');

    expect(verification).toBeDefined();
    expect(verification?.status).toBe('approved');
    expect(verification?.resolvedTrusteeId).toBeTruthy();
    expect(verification?.resolvedTrusteeName).toBeTruthy();
    expect([...((verification?.affectedCaseIds as string[] | undefined) ?? [])].sort()).toEqual([
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
