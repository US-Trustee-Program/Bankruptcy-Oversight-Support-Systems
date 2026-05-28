import { describe, test, expect, vi } from 'vitest';
import type { SeedContext } from '../../runner.js';
import { generate } from './trustees-comprehensive.js';

describe('trustees-comprehensive scenario', () => {
  const mockContext: SeedContext = {
    generateCaseId: vi.fn(),
  };

  test('generates 32 trustees and 32 appointments', async () => {
    const ops = await generate(mockContext);

    expect(ops).toHaveLength(2);

    const trusteesOp = ops.find((op) => op.collectionOrTable === 'trustees');
    const appointmentsOp = ops.find((op) => op.collectionOrTable === 'trustee-appointments');

    expect(trusteesOp?.db).toBe('cams');
    expect(trusteesOp?.data).toHaveLength(32);

    expect(appointmentsOp?.db).toBe('cams');
    expect(appointmentsOp?.data).toHaveLength(32);
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
      expect(appt.appointmentType).toMatch(/^(panel|standing)$/);
      expect(Array.isArray(appt.divisionCodes)).toBe(true);
      expect((appt.divisionCodes as unknown[]).length).toBeGreaterThan(0);
    });
  });

  test('all trustees are from Manhattan (NY)', async () => {
    const ops = await generate(mockContext);
    const trustees = ops.find((op) => op.collectionOrTable === 'trustees')?.data || [];
    const states = new Set(
      trustees.map(
        (t: Record<string, unknown>) =>
          ((t.public as Record<string, unknown>).address as Record<string, unknown>)
            .state as string,
      ),
    );

    expect(states.size).toBe(1);
    expect(states).toContain('NY'); // All New York (Manhattan divisions 081, 091)
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

  test('includes multi-division appointments', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const multiDivision = appointments.filter(
      (a: Record<string, unknown>) => (a.divisionCodes as unknown[]).length > 1,
    );

    expect(multiDivision.length).toBe(3); // NY, TX-all, CA-all
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

  test('Chapter 7 has expected count (11 trustees)', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch7 = appointments.filter((a: Record<string, unknown>) => a.chapter === '7');

    expect(ch7.length).toBe(11); // 10 + TX-all
  });

  test('Chapter 13 has expected count (9 trustees)', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch13 = appointments.filter((a: Record<string, unknown>) => a.chapter === '13');

    expect(ch13.length).toBe(9); // 8 + CA-all
  });

  test('Chapter 11 has expected count (6 trustees)', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch11 = appointments.filter((a: Record<string, unknown>) => a.chapter === '11');

    expect(ch11.length).toBe(6);
  });

  test('Chapter 12 has expected count (3 trustees)', async () => {
    const ops = await generate(mockContext);
    const appointments =
      ops.find((op) => op.collectionOrTable === 'trustee-appointments')?.data || [];
    const ch12 = appointments.filter((a: Record<string, unknown>) => a.chapter === '12');

    expect(ch12.length).toBe(3);
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
