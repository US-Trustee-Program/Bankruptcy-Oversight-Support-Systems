import { describe, test, expect, vi } from 'vitest';
import {
  chapterAppointmentTypeMap,
  getStatusOptions,
  isAppointmentMatch,
  TrusteeAppointment,
} from '@common/cams/trustee-appointments.js';
import type { AppointmentChapterType, AppointmentType } from '@common/cams/trustees.js';
import type { SeedContext, SeedOperation } from '../../runner.js';
import { generate as generateCases } from './cases-fuzzy-search.js';
import { generate } from './trustee-appointment-tasks.js';

function context(): SeedContext {
  return { generateCaseId: vi.fn() };
}

function docs(ops: SeedOperation[], collectionOrTable: string) {
  return ops.filter((o) => o.collectionOrTable === collectionOrTable).flatMap((o) => o.data);
}

/** An identity task with its surrogate case appointment, its candidates and their coverage. */
function identityTask(ops: SeedOperation[], id: string) {
  const task = docs(ops, 'trustee-match-verification').find((t) => t.id === id);
  const surrogates = docs(ops, 'trustee-case-appointments').filter(
    (a) => task && a.trusteeId === task.fingerprint,
  );
  const findings = task?.findings as { candidates: { camsRaw: { trusteeId: string } }[] };
  const candidateIds = (findings?.candidates ?? []).map((c) => c.camsRaw.trusteeId);
  const appointments = docs(ops, 'trustee-appointments') as unknown as TrusteeAppointment[];
  const covers = (trusteeId: string) =>
    isAppointmentMatch(
      appointments.filter((a) => a.trusteeId === trusteeId),
      surrogates[0]?.courtId as string,
      surrogates[0]?.courtDivisionCode as string,
      surrogates[0]?.chapter as string,
    );
  const appointmentTasksFor = (trusteeId: string) =>
    docs(ops, 'trustee-appointment-verification').filter(
      (t) =>
        t.trusteeId === trusteeId &&
        t.courtId === surrogates[0]?.courtId &&
        t.divisionCode === surrogates[0]?.courtDivisionCode &&
        t.chapter === surrogates[0]?.chapter,
    );
  return { task, surrogates, candidateIds, covers, appointmentTasksFor };
}

describe('trustee-appointment-tasks (CAMS-956)', () => {
  test('should seed one task per (trustee, court, division, chapter)', async () => {
    const tasks = docs(await generate(context()), 'trustee-appointment-verification');

    const keys = tasks.map((t) => [t.trusteeId, t.courtId, t.divisionCode, t.chapter].join('|'));
    expect(new Set(keys).size).toBe(keys.length);
    // At least one task in each state and for each reason, so every UAT path has a fixture.
    expect(tasks.some((t) => t.status === 'pending')).toBe(true);
    expect(tasks.some((t) => t.status === 'approved')).toBe(true);
    expect(tasks.some((t) => t.reason === 'no-appointment')).toBe(true);
    expect(tasks.some((t) => t.reason === 'appointment-inactive')).toBe(true);
  });

  test('should give every task case a CASE_APPOINTMENT in both partitions that matches the predicate', async () => {
    const ops = await generate(context());
    const tasks = docs(ops, 'trustee-appointment-verification');

    for (const collection of ['case-trustee-appointments', 'trustee-case-appointments']) {
      const caseAppointments = docs(ops, collection);
      for (const task of tasks) {
        for (const caseId of task.caseIds as string[]) {
          const match = caseAppointments.find(
            (a) =>
              a.caseId === caseId &&
              a.trusteeId === task.trusteeId &&
              a.courtId === task.courtId &&
              a.courtDivisionCode === task.divisionCode &&
              a.chapter === task.chapter,
          );
          expect(match, `${collection} ${caseId}`).toBeDefined();
          expect(
            (match?.checks as { matchedTrusteeAppointment: boolean }).matchedTrusteeAppointment,
          ).toBe(task.status === 'approved');
        }
      }
    }
  });

  test('should leave each pending task uncovered except the two ready to resolve', async () => {
    const ops = await generate(context());
    const appointments = docs(ops, 'trustee-appointments') as unknown as TrusteeAppointment[];

    const covered = docs(ops, 'trustee-appointment-verification')
      .filter((t) => t.status === 'pending')
      .filter((t) =>
        isAppointmentMatch(
          appointments.filter((a) => a.trusteeId === t.trusteeId),
          t.courtId as string,
          t.divisionCode as string,
          t.chapter as string,
        ),
      )
      .map((t) => t.id);

    expect(covered).toEqual([
      'seed-appt-task-ready-delaware-7',
      'seed-appt-task-partial-delaware-7',
    ]);
  });

  test('should seed every referenced trustee', async () => {
    const ops = await generate(context());
    const trusteeIds = new Set(docs(ops, 'trustees').map((t) => t.trusteeId));

    for (const task of docs(ops, 'trustee-appointment-verification')) {
      expect(trusteeIds.has(task.trusteeId)).toBe(true);
    }
  });

  test('should seed records that never join a task: a placeholder and a parked record', async () => {
    const ops = await generate(context());
    const joined = new Set(
      docs(ops, 'trustee-appointment-verification').flatMap((t) => t.caseIds as string[]),
    );
    const caseAppointments = docs(ops, 'trustee-case-appointments');

    const placeholder = caseAppointments.find(
      (a) => (a.checks as { matchedTrustee?: boolean } | undefined)?.matchedTrustee === false,
    );
    const parked = caseAppointments.find((a) => a.documentType === 'CASE_APPOINTMENT_UNATTACHED');
    // Guards the lookups below from passing vacuously on an undefined case id.
    expect(placeholder).toBeDefined();
    expect(parked).toBeDefined();
    expect(joined.has(placeholder?.caseId as string)).toBe(false);
    expect(joined.has(parked?.caseId as string)).toBe(false);
  });

  test('should leave one case on the partial task still refreshable', async () => {
    const ops = await generate(context());
    const task = docs(ops, 'trustee-appointment-verification').find(
      (t) => t.id === 'seed-appt-task-partial-delaware-7',
    );
    const open = docs(ops, 'trustee-case-appointments').filter(
      (a) => a.trusteeId === task?.trusteeId && !a.unassignedOn,
    );

    // Guards the filter above from matching on an undefined trustee.
    expect(task).toBeDefined();
    expect(task?.caseIds).toHaveLength(3);
    expect(open).toHaveLength(1);
  });

  test('should move the reassigned case to another trustee that holds a covered appointment', async () => {
    const ops = await generate(context());
    const partial = docs(ops, 'trustee-appointment-verification').find(
      (t) => t.id === 'seed-appt-task-partial-delaware-7',
    );
    const closedForPartial = docs(ops, 'trustee-case-appointments').filter(
      (a) => a.trusteeId === partial?.trusteeId && a.unassignedOn,
    );
    expect(partial).toBeDefined();
    expect(closedForPartial).toHaveLength(2);
    const reassigned = docs(ops, 'trustee-case-appointments').filter(
      (a) =>
        !a.unassignedOn &&
        a.trusteeId !== partial?.trusteeId &&
        closedForPartial.some((c) => c.caseId === a.caseId),
    );
    expect(reassigned).toHaveLength(1);
    expect(
      (reassigned[0].checks as { matchedTrusteeAppointment: boolean }).matchedTrusteeAppointment,
    ).toBe(true);
    // Only the partial task holds that case, through the trustee that no longer has it open.
    expect(
      docs(ops, 'trustee-appointment-verification')
        .filter((t) => (t.caseIds as string[]).includes(reassigned[0].caseId as string))
        .map((t) => t.trusteeId),
    ).toEqual([partial?.trusteeId]);
  });

  test('should seed only appointments the appointment form could create', async () => {
    const appointments = docs(await generate(context()), 'trustee-appointments');

    expect(appointments.length).toBeGreaterThan(0);
    for (const appointment of appointments) {
      const chapter = appointment.chapter as AppointmentChapterType;
      const type = appointment.appointmentType as AppointmentType;
      expect(Object.keys(chapterAppointmentTypeMap)).toContain(chapter);
      expect(chapterAppointmentTypeMap[chapter]).toContain(type);
      expect(getStatusOptions(chapter, type)).toContain(appointment.status);
    }
  });

  test('should only name tasks and case appointments on chapters a trustee can be appointed to', async () => {
    const ops = await generate(context());
    const appointable = Object.keys(chapterAppointmentTypeMap);

    for (const task of docs(ops, 'trustee-appointment-verification')) {
      expect(appointable).toContain(task.chapter);
    }
    for (const collection of ['case-trustee-appointments', 'trustee-case-appointments']) {
      for (const caseAppointment of docs(ops, collection)) {
        expect(appointable).toContain(caseAppointment.chapter);
      }
    }
  });

  test('should name only cases that exist in Cosmos once the prerequisite scenarios are seeded', async () => {
    const ops = await generate(context());
    const seededCaseIds = new Set(
      [...docs(await generateCases(context()), 'cases'), ...docs(ops, 'cases')].map(
        (c) => c.caseId,
      ),
    );
    const caseIds = [
      ...docs(ops, 'trustee-appointment-verification').flatMap((t) => t.caseIds as string[]),
      ...docs(ops, 'trustee-case-appointments')
        .filter((a) => a.documentType === 'CASE_APPOINTMENT')
        .map((a) => a.caseId as string),
    ];

    expect(caseIds.length).toBeGreaterThan(0);
    expect(caseIds.filter((caseId) => !seededCaseIds.has(caseId))).toEqual([]);
  });

  test('should give each generated case the chapter and court its appointment task uses', async () => {
    const ops = await generate(context());
    const generatedCases = docs(ops, 'cases');
    const tasks = docs(ops, 'trustee-appointment-verification');
    const taskFor = (caseId: unknown) =>
      tasks.find((t) => (t.caseIds as string[]).includes(caseId as string));

    expect(generatedCases.length).toBeGreaterThan(0);
    // Every generated case belongs to a task, except the one a placeholder sits on and the ones
    // an identity task's surrogate sits on (approving that identity task adds them to a task).
    const surrogateCaseIds = new Set(
      docs(ops, 'trustee-case-appointments')
        .filter((a) => a.isSurrogate)
        .map((a) => a.caseId),
    );
    const inTasks = generatedCases.filter((generated) => taskFor(generated.caseId));
    expect(inTasks.length).toBe(
      generatedCases.filter((generated) => !surrogateCaseIds.has(generated.caseId)).length,
    );
    expect(
      inTasks.map((generated) => ({
        chapter: generated.chapter,
        courtId: generated.courtId,
        courtDivisionCode: generated.courtDivisionCode,
      })),
    ).toEqual(
      inTasks.map((generated) => ({
        chapter: taskFor(generated.caseId)?.chapter,
        courtId: taskFor(generated.caseId)?.courtId,
        courtDivisionCode: taskFor(generated.caseId)?.divisionCode,
      })),
    );
  });

  test('should back every generated case with DXTR rows its detail page can load', async () => {
    const ops = await generate(context());
    const generatedCases = docs(ops, 'cases');
    const dxtrCases = docs(ops, 'AO_CS');
    const dxtrDebtors = docs(ops, 'AO_PY');
    const dxtrPetitions = docs(ops, 'AO_TX');

    expect(generatedCases.length).toBeGreaterThan(0);
    expect(dxtrCases).toHaveLength(generatedCases.length);
    for (const generated of generatedCases) {
      expect(dxtrCases).toContainEqual(
        expect.objectContaining({
          CS_CASEID: generated.dxtrId,
          COURT_ID: generated.courtId,
          CS_DIV: generated.courtDivisionCode,
          GRP_DES: generated.groupDesignator,
          CASE_ID: generated.caseNumber,
          CS_CHAPTER: generated.chapter,
        }),
      );
      expect(dxtrDebtors).toContainEqual(
        expect.objectContaining({
          CS_CASEID: generated.dxtrId,
          COURT_ID: generated.courtId,
          PY_ROLE: 'DB',
        }),
      );
      expect(dxtrPetitions).toContainEqual(
        expect.objectContaining({
          CS_CASEID: generated.dxtrId,
          COURT_ID: generated.courtId,
          TX_TYPE: '1',
          TX_CODE: '1',
        }),
      );
    }
  });

  test('should write a petition record the case summary query can read', async () => {
    const petitions = docs(await generate(context()), 'AO_TX');

    expect(petitions.length).toBeGreaterThan(0);
    for (const petition of petitions) {
      const rec = petition.REC as string;
      // The summary query reads debtor type from characters 34-35 and petition from 108-109.
      expect(rec.substring(33, 35)).toBe('IC');
      expect(rec.substring(107, 109)).toBe('VP');
      expect(petition).not.toHaveProperty('TX_ID');
    }
  });

  describe('identity tasks whose approval reaches an existing appointment task', () => {
    test('should seed a pending identity task whose sole, uncovered candidate already has an open task on its case tuple', async () => {
      const ops = await generate(context());
      const { task, surrogates, candidateIds, covers, appointmentTasksFor } = identityTask(
        ops,
        'seed-match-appt-join',
      );

      expect(task?.status).toBe('pending');
      expect(surrogates).toHaveLength(1);
      expect(candidateIds).toHaveLength(1);
      expect(covers(candidateIds[0])).toBe(false);
      const existing = appointmentTasksFor(candidateIds[0]);
      expect(existing.map((t) => t.status)).toEqual(['pending']);
      expect(existing[0].caseIds).not.toContain(surrogates[0].caseId);
    });

    test('should seed a pending identity task whose sole candidate has a resolved task on its case tuple and lost coverage since', async () => {
      const ops = await generate(context());
      const { task, surrogates, candidateIds, covers, appointmentTasksFor } = identityTask(
        ops,
        'seed-match-appt-reopen',
      );

      expect(task?.status).toBe('pending');
      expect(surrogates).toHaveLength(1);
      expect(candidateIds).toHaveLength(1);
      expect(covers(candidateIds[0])).toBe(false);
      const existing = appointmentTasksFor(candidateIds[0]);
      expect(existing.map((t) => t.status)).toEqual(['approved']);
      expect(existing[0].caseIds).not.toContain(surrogates[0].caseId);
    });

    test('should seed a pending identity task with two candidates of which exactly one covers its case', async () => {
      const ops = await generate(context());
      const { task, surrogates, candidateIds, covers, appointmentTasksFor } = identityTask(
        ops,
        'seed-match-appt-stale',
      );

      expect(task?.status).toBe('pending');
      expect(surrogates).toHaveLength(1);
      expect(candidateIds).toHaveLength(2);
      expect(candidateIds.map(covers).sort()).toEqual([false, true]);
      expect(candidateIds.flatMap(appointmentTasksFor)).toEqual([]);
    });

    test('should dual-write each identity-task surrogate to both partitions and seed its candidates', async () => {
      const ops = await generate(context());
      const trusteeIds = new Set(docs(ops, 'trustees').map((t) => t.trusteeId));

      const ids = ['seed-match-appt-join', 'seed-match-appt-reopen', 'seed-match-appt-stale'];
      const tasks = ids.map((id) => identityTask(ops, id));

      expect(tasks.map(({ surrogates }) => surrogates.length)).toEqual([1, 1, 1]);
      for (const { surrogates } of tasks) {
        expect(docs(ops, 'case-trustee-appointments')).toContainEqual(surrogates[0]);
      }
      const unseeded = tasks
        .flatMap(({ candidateIds }) => candidateIds)
        .filter((candidateId) => !trusteeIds.has(candidateId));
      expect(unseeded).toEqual([]);
    });
  });

  test('should use court, division and group combinations that exist in DXTR', async () => {
    const generatedCases = docs(await generate(context()), 'cases');
    const combinations = new Set(
      generatedCases.map((c) => `${c.courtId}/${c.courtDivisionCode}/${c.groupDesignator}`),
    );

    // Manhattan is 0208/081/NY and Delaware is 0311/111/WL in the real data.
    expect([...combinations].sort()).toEqual(['0208/081/NY', '0311/111/WL']);
  });
});
