import { describe, test, expect, vi } from 'vitest';
import type { SeedContext } from '../../runner.js';
import { generate } from './trustees-comprehensive.js';

describe('trustees-comprehensive scenario', () => {
  const mockContext: SeedContext = {
    generateCaseId: vi.fn(),
  };

  test('generates 33 trustees and 38 appointments', async () => {
    const ops = await generate(mockContext);

    expect(ops).toHaveLength(2);

    const trusteesOp = ops.find((op) => op.collectionOrTable === 'trustees');
    const appointmentsOp = ops.find((op) => op.collectionOrTable === 'trustee-appointments');

    expect(trusteesOp?.db).toBe('cams');
    expect(trusteesOp?.data).toHaveLength(33);

    // 33 single-court trustees + Patricia Manhattan's 5 extra cross-court
    // appointments (CA Eastern, CA Northern, ID, IA Northern, IA Southern) = 38.
    expect(appointmentsOp?.db).toBe('cams');
    expect(appointmentsOp?.data).toHaveLength(38);
  });

  test('all trustees have documentType TRUSTEE', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];

    trustees.forEach((trustee: Record<string, unknown>) => {
      expect(trustee.documentType).toBe('TRUSTEE');
      expect(trustee.trusteeId).toBeTruthy();
      expect(trustee.name).toBeTruthy();
      expect(trustee.firstName).toBeTruthy();
      expect(trustee.lastName).toBeTruthy();
      expect(trustee.status).toMatch(/^(active|inactive)$/);
    });
  });

  test('all trustees have phoneticTokens', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];

    trustees.forEach((trustee: Record<string, unknown>) => {
      expect(trustee.phoneticTokens).toBeDefined();
      expect(Array.isArray(trustee.phoneticTokens)).toBe(true);
      expect((trustee.phoneticTokens as unknown[]).length).toBeGreaterThan(0);
    });
  });

  test('all appointments have documentType TRUSTEE_APPOINTMENT', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];

    appointments.forEach((appt: Record<string, unknown>) => {
      expect(appt.documentType).toBe('TRUSTEE_APPOINTMENT');
      expect(appt.trusteeId).toBeTruthy();
      expect(appt.chapter).toBeTruthy();
      expect(appt.appointmentType).toMatch(/^(panel|standing|off-panel|case-by-case|pool)$/);
      expect(Array.isArray(appt.divisionCodes)).toBe(true);
      expect((appt.divisionCodes as unknown[]).length).toBeGreaterThan(0);
    });
  });

  test('all 33 trustees are based in New York', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];

    const byState = trustees.reduce((acc: Record<string, number>, t: Record<string, unknown>) => {
      const state = ((t.public as Record<string, unknown>).address as Record<string, unknown>)
        .state as string;
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    // All trustees are seeded with NY public addresses; Patricia Manhattan
    // (seed-trustee-ny-002) holds appointments in other states but the
    // trustee profile itself is NY.
    expect(byState).toEqual({ NY: 33 });
  });

  test('includes all chapter types', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const chapters = new Set(appointments.map((a: Record<string, unknown>) => a.chapter));

    expect(chapters).toContain('7');
    expect(chapters).toContain('11');
    expect(chapters).toContain('12');
    expect(chapters).toContain('13');
    expect(chapters).toContain('11-subchapter-v');
  });

  test('includes panel, standing, pool, off-panel, and case-by-case appointment types', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const types = new Set(appointments.map((a: Record<string, unknown>) => a.appointmentType));

    expect(types).toContain('panel');
    expect(types).toContain('standing');
    expect(types).toContain('pool');
    expect(types).toContain('off-panel');
    expect(types).toContain('case-by-case');
  });

  test('includes a trustee with appointments in multiple courts', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];

    // Patricia Manhattan (seed-trustee-ny-002) holds appointments in NY plus
    // five additional courts (CA Eastern, CA Northern, ID, IA Northern, IA
    // Southern) — total 6 appointments to model a multi-court trustee.
    const ny002Appts = appointments.filter(
      (a: Record<string, unknown>) => a.trusteeId === 'seed-trustee-ny-002',
    );
    expect(ny002Appts.length).toBe(6);
  });

  test('includes both active and inactive statuses', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];
    const statuses = new Set(trustees.map((t: Record<string, unknown>) => t.status));

    expect(statuses).toContain('active');
    expect(statuses).toContain('inactive');
  });

  test('each trustee has a corresponding appointment', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];

    const trusteeIds = new Set(trustees.map((t: Record<string, unknown>) => t.trusteeId));
    const appointmentTrusteeIds = new Set(
      appointments.map((a: Record<string, unknown>) => a.trusteeId),
    );

    expect(trusteeIds.size).toBe(33);
    expect(appointmentTrusteeIds.size).toBe(33);
    expect([...trusteeIds]).toEqual([...appointmentTrusteeIds]);
  });

  // Chapter 7: 11 single-court appointments + 2 from Patricia Manhattan (CA Eastern off-panel, CA Eastern panel)
  // Chapter 11: 6 single-court appointments + 1 from Patricia Manhattan (CA Northern case-by-case) + 1 inactive Ch11 case-by-case (Additional-25)
  // Chapter 12: 3 single-court appointments + 1 from Patricia Manhattan (ID standing)
  // Chapter 13: 8 single-court appointments + 2 from Patricia Manhattan (IA Northern case-by-case, IA Southern standing)
  // Chapter 11 Subchapter V: 3 single-court appointments
  test.each([
    ['7', 13],
    ['11', 8],
    ['12', 4],
    ['13', 10],
    ['11-subchapter-v', 3],
  ])('chapter %s appointments have expected count of %i', async (chapter, expectedCount) => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const matching = appointments.filter((a: Record<string, unknown>) => a.chapter === chapter);

    expect(matching).toHaveLength(expectedCount);
  });

  test('single-division appointments include the deprecated divisionCode field for backward compatibility', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];

    // Every appointment in this file currently has exactly one divisionCode
    // (081 and 091 belong to two different courts, not two divisions of one
    // court — see file header comment), so `divisionCode` should always be
    // set to that single code.
    appointments.forEach((appt: Record<string, unknown>) => {
      const divisionCodes = appt.divisionCodes as string[];
      expect(divisionCodes).toHaveLength(1);
      expect(appt.divisionCode).toBe(divisionCodes[0]);
    });
  });

  test('trustees with bank/software/zoomInfo/middleName data include those optional fields', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];
    const byId = new Map(trustees.map((t: Record<string, unknown>) => [t.trusteeId, t]));

    const ny001 = byId.get('seed-trustee-ny-001') as Record<string, unknown>;
    expect(ny001.banks).toEqual(['seed-bank-active-001']);
    expect(ny001.softwareId).toBe('seed-software-active-001');

    const ny002 = byId.get('seed-trustee-ny-002') as Record<string, unknown>;
    expect(ny002.zoomInfo).toBeDefined();

    const withMiddleName = byId.get('seed-trustee-add-003') as Record<string, unknown>;
    expect(withMiddleName.middleName).toBe('Lynn');
  });

  test('trustees without bank/software/zoomInfo/middleName data omit those optional fields entirely', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];
    const byId = new Map(trustees.map((t: Record<string, unknown>) => [t.trusteeId, t]));

    const withoutExtras = byId.get('seed-trustee-add-001') as Record<string, unknown>;
    expect(withoutExtras).not.toHaveProperty('middleName');
    expect(withoutExtras).not.toHaveProperty('zoomInfo');
    expect(withoutExtras).not.toHaveProperty('banks');
    expect(withoutExtras).not.toHaveProperty('softwareId');
  });
});
