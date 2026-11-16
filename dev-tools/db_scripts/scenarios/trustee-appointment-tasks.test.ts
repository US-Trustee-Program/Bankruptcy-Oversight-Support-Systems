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

    expect(covered).toEqual(['seed-appt-task-ready-chicago-7', 'seed-appt-task-partial-chicago-7']);
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

    const placeholder = caseAppointments.find((a) => a.isSurrogate);
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
      (t) => t.id === 'seed-appt-task-partial-chicago-7',
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
      (t) => t.id === 'seed-appt-task-partial-chicago-7',
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
    // Every generated case belongs to a task, except the one a placeholder sits on.
    const inTasks = generatedCases.filter((generated) => taskFor(generated.caseId));
    expect(inTasks.length).toBe(generatedCases.length - 1);
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
});
