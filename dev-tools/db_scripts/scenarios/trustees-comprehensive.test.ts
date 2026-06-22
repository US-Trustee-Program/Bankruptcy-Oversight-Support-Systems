import { describe, test, expect, vi } from 'vitest';
import type { SeedContext } from '../../runner.js';
import { generate } from './trustees-comprehensive.js';

describe('trustees-comprehensive scenario', () => {
  const mockContext: SeedContext = {
    generateCaseId: vi.fn(),
  };

  test('generates 32 trustees and 37 appointments', async () => {
    const ops = await generate(mockContext);

    expect(ops).toHaveLength(2);

    const trusteesOp = ops.find((op) => op.collectionOrTable === 'trustees');
    const appointmentsOp = ops.find((op) => op.collectionOrTable === 'trustee-appointments');

    expect(trusteesOp?.db).toBe('cams');
    expect(trusteesOp?.data).toHaveLength(32);

    // 32 single-court trustees + Patricia Manhattan's 5 extra cross-court
    // appointments (CA Eastern, CA Northern, ID, IA Northern, IA Southern) = 37.
    expect(appointmentsOp?.db).toBe('cams');
    expect(appointmentsOp?.data).toHaveLength(37);
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
      expect(appt.appointmentType).toMatch(/^(panel|standing|off-panel|case-by-case)$/);
      expect(Array.isArray(appt.divisionCodes)).toBe(true);
      expect((appt.divisionCodes as unknown[]).length).toBeGreaterThan(0);
    });
  });

  test('all trustees are based in New York', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];
    const states = new Set(
      trustees.map(
        (t: Record<string, unknown>) =>
          ((t.public as Record<string, unknown>).address as Record<string, unknown>)
            .state as string,
      ),
    );

    // All trustees are seeded with NY public addresses; Patricia Manhattan
    // (seed-trustee-ny-002) holds appointments in other states but the
    // trustee profile itself is NY.
    expect(states.size).toBe(1);
    expect(states).toContain('NY');
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

  test('includes both panel and standing appointment types', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const types = new Set(appointments.map((a: Record<string, unknown>) => a.appointmentType));

    expect(types).toContain('panel');
    expect(types).toContain('standing');
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

    expect(trusteeIds.size).toBe(32);
    expect(appointmentTrusteeIds.size).toBe(32);
    expect([...trusteeIds]).toEqual([...appointmentTrusteeIds]);
  });

  test('all 32 trustees are from New York', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];

    const byState = trustees.reduce((acc: Record<string, number>, t: Record<string, unknown>) => {
      const state = ((t.public as Record<string, unknown>).address as Record<string, unknown>)
        .state as string;
      acc[state] = (acc[state] || 0) + 1;
      return acc;
    }, {});

    expect(byState['NY']).toBe(32); // All trustees from New York (Manhattan divisions)
    expect(Object.keys(byState).length).toBe(1); // Only NY
  });

  test('Chapter 7 appointments have expected count', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch7 = appointments.filter((a: Record<string, unknown>) => a.chapter === '7');

    // 11 single-court ch7 appointments + 2 from Patricia Manhattan
    // (CA Eastern off-panel, CA Eastern panel)
    expect(ch7.length).toBe(13);
  });

  test('Chapter 13 appointments have expected count', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch13 = appointments.filter((a: Record<string, unknown>) => a.chapter === '13');

    // 8 single-court ch13 appointments + 2 from Patricia Manhattan
    // (IA Northern case-by-case, IA Southern standing)
    expect(ch13.length).toBe(10);
  });

  test('Chapter 11 appointments have expected count', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch11 = appointments.filter((a: Record<string, unknown>) => a.chapter === '11');

    // 6 single-court ch11 appointments + 1 from Patricia Manhattan
    // (CA Northern case-by-case)
    expect(ch11.length).toBe(7);
  });

  test('Chapter 12 appointments have expected count', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch12 = appointments.filter((a: Record<string, unknown>) => a.chapter === '12');

    // 3 single-court ch12 appointments + 1 from Patricia Manhattan (ID standing)
    expect(ch12.length).toBe(4);
  });

  test('Chapter 11 Subchapter V has expected count (3 trustees)', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch11v = appointments.filter(
      (a: Record<string, unknown>) => a.chapter === '11-subchapter-v',
    );

    expect(ch11v.length).toBe(3);
  });
});
