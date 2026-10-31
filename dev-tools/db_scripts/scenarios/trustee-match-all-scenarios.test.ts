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

function findTrustee(ops: SeedOperation[], trusteeId: unknown) {
  return ops
    .filter((o) => o.collectionOrTable === 'trustees')
    .flatMap((o) => o.data)
    .find((d) => d.trusteeId === trusteeId);
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
    // single-case tasks + 1 multi-case + 1 division-mismatch + 1 no-cases task + 1 caseless task.
    expect(pendingTasks(ops)).toHaveLength(11);
    // seed-match-no-cases-* (CAMS-953 "No cases affected yet") and seed-match-caseless (CAMS-953
    // Slice 5, no case at all) are the deliberate exceptions: neither has a surrogate anywhere,
    // including for its own originating case (the caseless task has no originating case to begin
    // with). See the dedicated tests below.
    const tasksExpectingASurrogate = pendingTasks(ops).filter(
      (task) =>
        !(task.id as string).startsWith('seed-match-no-cases-') &&
        task.id !== 'seed-match-caseless',
    );
    expect(tasksExpectingASurrogate).toHaveLength(9);
    for (const task of tasksExpectingASurrogate) {
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
    // The caseless task's caseId is undefined; excluded here since this test is about distinct
    // real case IDs, not about counting how many pending tasks have no case at all.
    const caseIds = pendingTasks(ops)
      .map((task) => task.caseId)
      .filter((caseId): caseId is string => caseId !== undefined);

    // Guards the Set-size comparison below from passing vacuously if caseIds were ever empty.
    expect(caseIds.length).toBe(10);
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

  test('should have no surrogate rows for a pending no-cases mismatch, including its own case', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-no-cases-091-99-05433');

    expect(verification).toBeDefined();
    expect(verification?.status).toBe('pending');
    expect(verification?.fingerprint).toBeTruthy();
    expect(
      (verification?.findings as { candidates: unknown[] } | undefined)?.candidates,
    ).toHaveLength(2);

    for (const table of ['case-trustee-appointments', 'trustee-case-appointments']) {
      const surrogates = surrogatesFor(ops, table);
      const forThisFingerprint = surrogates.filter(
        (s) => s.trusteeId === verification?.fingerprint,
      );
      expect(forThisFingerprint).toHaveLength(0);
    }
  });

  test('should have no caseId/courtId and no surrogate rows for a pending caseless mismatch', async () => {
    const ops = await generate(context());
    const verification = findVerification(ops, 'seed-match-caseless');

    expect(verification).toBeDefined();
    expect(verification?.status).toBe('pending');
    expect(verification?.fingerprint).toBeTruthy();
    expect('caseId' in (verification ?? {})).toBe(false);
    expect('courtId' in (verification ?? {})).toBe(false);

    for (const table of ['case-trustee-appointments', 'trustee-case-appointments']) {
      const surrogates = surrogatesFor(ops, table);
      const forThisFingerprint = surrogates.filter(
        (s) => s.trusteeId === verification?.fingerprint,
      );
      expect(forThisFingerprint).toHaveLength(0);
    }
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

    const resolvedTrustee = findTrustee(ops, verification?.resolvedTrusteeId);
    expect(resolvedTrustee).toBeDefined();
    expect(resolvedTrustee?.name).toBe(verification?.resolvedTrusteeName);

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

    const resolvedTrustee = findTrustee(ops, verification?.resolvedTrusteeId);
    expect(resolvedTrustee).toBeDefined();
    expect(resolvedTrustee?.name).toBe(verification?.resolvedTrusteeName);

    expect([...((verification?.affectedCaseIds as string[] | undefined) ?? [])].sort()).toEqual([
      '091-99-25850',
      '091-99-26681',
      '091-99-26914',
    ]);

    expectNoSurrogates(ops, verification?.fingerprint);
  });
});
