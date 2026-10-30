import { isDeepStrictEqual } from 'node:util';
import { describe, test, expect, vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data.js';
import { TRUSTEE_MATCH_FINDINGS_SCENARIOS } from '@common/cams/test-utilities/trustee-match-findings.scenarios.js';
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

/** No surrogate CASE_APPOINTMENT survives, in either partition, for the given fingerprint. */
function expectNoSurrogates(ops: SeedOperation[], fingerprint: unknown) {
  for (const table of ['case-trustee-appointments', 'trustee-case-appointments']) {
    const forThisFingerprint = surrogatesFor(ops, table).filter((s) => s.trusteeId === fingerprint);
    expect(forThisFingerprint).toHaveLength(0);
  }
}

// Slice 3's explanation sentences differ by which fields a single candidate mismatches; these
// scenarios give each sentence shape a pending task in the dev data for demos and UX sign-off.
describe('trustee-match-all-scenarios (CAMS-953 explanation sentence scenarios)', () => {
  test.each([
    'noCandidates',
    'multipleCandidates',
    'oneCandidateAddressAndPhoneDiffer',
    'oneCandidateStateDiffers',
    'oneCandidateNameAddressEmailDiffer',
    'oneCandidateExactName',
    'oneCandidateNothingDiffers',
  ] as const)(
    'should seed a pending task with the %s findings and its candidate trustee',
    async (key) => {
      const ops = await generate(context());
      const findings = MockData.getTrusteeMatchScenarioFindings(key);

      const task = ops
        .filter((o) => o.collectionOrTable === 'trustee-match-verification')
        .flatMap((o) => o.data)
        .find((d) => isDeepStrictEqual(d.findings, findings));
      expect(task?.status).toBe('pending');

      const trusteeIds = ops
        .filter((o) => o.collectionOrTable === 'trustees')
        .flatMap((o) => o.data)
        .map((d) => d.trusteeId);
      for (const trustee of TRUSTEE_MATCH_FINDINGS_SCENARIOS[key].trustees) {
        expect(trusteeIds).toContain(trustee.trusteeId);
      }
    },
  );
});

// The DXTR sync writes a surrogate CASE_APPOINTMENT for every case it raises a task for, and
// approval derives the cases to check and remap from those surrogates alone.
describe('trustee-match-all-scenarios (pending tasks look like sync output)', () => {
  function pendingTasks(ops: SeedOperation[]) {
    return ops
      .filter((o) => o.collectionOrTable === 'trustee-match-verification')
      .flatMap((o) => o.data)
      .filter((d) => d.status === 'pending');
  }

  test('should give every pending task a surrogate for its own case in both partitions', async () => {
    const ops = await generate(context());

    // Guards the loop below from passing vacuously if pendingTasks(ops) were ever empty: 7
    // single-case tasks + 1 multi-case + 1 division-mismatch task.
    expect(pendingTasks(ops)).toHaveLength(9);
    for (const task of pendingTasks(ops)) {
      for (const table of ['case-trustee-appointments', 'trustee-case-appointments']) {
        const surrogateCaseIds = surrogatesFor(ops, table)
          .filter((s) => s.trusteeId === task.fingerprint && s.isSurrogate === true)
          .map((s) => s.caseId);
        expect(surrogateCaseIds).toContain(task.caseId);
      }
    }
  });

  test('should not seed two pending tasks on the same case', async () => {
    const ops = await generate(context());
    const caseIds = pendingTasks(ops).map((task) => task.caseId);

    // Guards the Set-size comparison below from passing vacuously if caseIds were ever empty.
    expect(caseIds.length).toBe(9);
    expect(new Set(caseIds).size).toBe(caseIds.length);
  });

  // dxtr-historical-trustees gives these cases real trustee appointments, and the sync never
  // raises a task for a case whose trustee it resolved.
  test('should not put identity tasks or surrogates on dxtr-historical-trustees cases', async () => {
    const historicalCaseIds = [
      '091-99-86706',
      '091-99-87899',
      '091-99-99943',
      '091-99-97816',
      '091-99-98483',
    ];
    const ops = await generate(context());
    const tasks = ops
      .filter((o) => o.collectionOrTable === 'trustee-match-verification')
      .flatMap((o) => o.data);
    const caseIds = [
      ...tasks.flatMap((task) => [task.caseId, ...((task.affectedCaseIds as string[]) ?? [])]),
      ...surrogatesFor(ops, 'case-trustee-appointments').map((s) => s.caseId),
    ] as string[];

    expect(caseIds.filter((caseId) => historicalCaseIds.includes(caseId))).toEqual([]);
  });
});

// These cover the CAMS-871 additions (multi-case mismatches) and the division-mismatch scenario.
// The single-case scenarios are covered by the sentence-shape test.each above; anything not
// covered by a dedicated test here still gets the generic data-quality checks in
// all-scenarios.validation.test.ts.
describe('trustee-match-all-scenarios (CAMS-871 multi-case additions)', () => {
  test('should share the verification fingerprint across both partitions for a pending multi-case mismatch', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-multicase-091-99-25850');

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
      expect(caseIds).toEqual(['091-99-25850', '091-99-26681', '091-99-26914']);
    }
  });

  test('should let a candidate cover two cases but not the third for a pending division-mismatch task', async () => {
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
    }

    const candidates = (
      verification?.findings as { candidates: { camsRaw: { trusteeId: string } }[] } | undefined
    )?.candidates;
    const candidateTrusteeId = candidates?.[0]?.camsRaw.trusteeId;
    expect(candidateTrusteeId).toBe('seed-trustee-match-divisionmismatch');

    const appointments = ops
      .filter((o) => o.collectionOrTable === 'trustee-appointments')
      .flatMap((o) => o.data)
      .filter((a) => a.trusteeId === candidateTrusteeId);
    expect(appointments).toHaveLength(1);
    const [appointment] = appointments;
    expect(appointment.chapter).toBe('11');

    // The whole point of this fixture: two of the three cases share a division the candidate is
    // appointed in; the third is a genuinely different court+division the candidate is not.
    const surrogates = surrogatesFor(ops, 'case-trustee-appointments').filter(
      (s) => s.trusteeId === verification?.fingerprint,
    );
    const divisionsByCaseId = Object.fromEntries(
      surrogates.map((s) => [s.caseId, s.courtDivisionCode]),
    );
    expect(divisionsByCaseId['091-99-40761']).toBe(divisionsByCaseId['091-99-11079']);
    expect(divisionsByCaseId['081-23-10005']).not.toBe(divisionsByCaseId['091-99-40761']);
    expect(appointment.divisionCodes).toContain(divisionsByCaseId['091-99-40761']);
    expect(appointment.divisionCodes).not.toContain(divisionsByCaseId['081-23-10005']);
  });

  test('should have no surviving surrogate rows for an already-approved mismatch', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-resolved-no-surrogates-091-99-28263');

    expect(verification).toBeDefined();
    expect(verification?.status).toBe('approved');
    expect(verification?.resolvedTrusteeId).toBeTruthy();
    expect(verification?.resolvedTrusteeName).toBeTruthy();
    // Without this, an undefined fingerprint would match undefined surrogate trusteeIds and
    // expectNoSurrogates below would pass vacuously.
    expect(verification?.fingerprint).toBeTruthy();

    expectNoSurrogates(ops, verification?.fingerprint);
  });

  test('should have a populated affectedCaseIds snapshot and no surviving surrogate rows for an already-approved multi-case mismatch', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-resolved-with-snapshot-091-99-25850');

    expect(verification).toBeDefined();
    expect(verification?.status).toBe('approved');
    expect(verification?.resolvedTrusteeId).toBeTruthy();
    expect(verification?.resolvedTrusteeName).toBeTruthy();
    expect(verification?.fingerprint).toBeTruthy();
    expect([...((verification?.affectedCaseIds as string[] | undefined) ?? [])].sort()).toEqual([
      '091-99-25850',
      '091-99-26681',
      '091-99-26914',
    ]);

    expectNoSurrogates(ops, verification?.fingerprint);
  });
});
