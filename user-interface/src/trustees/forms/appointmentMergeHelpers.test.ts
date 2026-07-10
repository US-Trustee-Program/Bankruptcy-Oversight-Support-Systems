import { describe, test, expect } from 'vitest';
import { CourtDivisionDetails } from '@common/cams/courts';
import { TrusteeAppointment, TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { findMergeTarget, buildMergeResult } from './appointmentMergeHelpers';

// ──────────────────────────────────────────────
// Shared fixtures
// ──────────────────────────────────────────────

const BASE_COURT_ID = '081-';

const COURTS: CourtDivisionDetails[] = [
  {
    courtId: BASE_COURT_ID,
    courtName: 'Eastern District of Missouri',
    courtDivisionCode: '301',
    courtDivisionName: 'Springfield',
    regionId: '08',
    regionName: 'Region 08',
    officeCode: 'MO',
    officeName: 'Missouri',
    groupDesignator: 'EO',
    state: 'MO',
  },
  {
    courtId: BASE_COURT_ID,
    courtName: 'Eastern District of Missouri',
    courtDivisionCode: '303',
    courtDivisionName: 'St. Louis',
    regionId: '08',
    regionName: 'Region 08',
    officeCode: 'MO',
    officeName: 'Missouri',
    groupDesignator: 'EO',
    state: 'MO',
  },
  {
    courtId: BASE_COURT_ID,
    courtName: 'Eastern District of Missouri',
    courtDivisionCode: '310',
    courtDivisionName: 'Cape Girardeau',
    regionId: '08',
    regionName: 'Region 08',
    officeCode: 'MO',
    officeName: 'Missouri',
    groupDesignator: 'EO',
    state: 'MO',
  },
];

function makeAppointment(overrides: Partial<TrusteeAppointment> = {}): TrusteeAppointment {
  return {
    id: 'appt-1',
    trusteeId: 'trustee-1',
    courtId: BASE_COURT_ID,
    chapter: '7',
    appointmentType: 'panel',
    divisionCodes: ['301'],
    appointedDate: '2020-01-01',
    status: 'active',
    effectiveDate: '2020-01-01',
    updatedOn: '2020-01-01T00:00:00.000Z',
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    ...overrides,
  };
}

function makePayload(overrides: Partial<TrusteeAppointmentInput> = {}): TrusteeAppointmentInput {
  return {
    courtId: BASE_COURT_ID,
    chapter: '7',
    appointmentType: 'panel',
    divisionCodes: ['303'],
    appointedDate: '2021-01-01',
    status: 'active',
    effectiveDate: '2021-01-01',
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// findMergeTarget
// ──────────────────────────────────────────────

describe('findMergeTarget', () => {
  test('returns undefined when the list is empty', () => {
    const result = findMergeTarget(BASE_COURT_ID, '7', 'panel', []);
    expect(result).toBeUndefined();
  });

  test('returns undefined when no appointment matches the courtId', () => {
    const appt = makeAppointment({ courtId: '097-' });
    const result = findMergeTarget(BASE_COURT_ID, '7', 'panel', [appt]);
    expect(result).toBeUndefined();
  });

  test('returns undefined when no appointment matches the chapter', () => {
    const appt = makeAppointment({ chapter: '13' });
    const result = findMergeTarget(BASE_COURT_ID, '7', 'panel', [appt]);
    expect(result).toBeUndefined();
  });

  test('returns undefined when no appointment matches the appointmentType', () => {
    const appt = makeAppointment({ appointmentType: 'off-panel' });
    const result = findMergeTarget(BASE_COURT_ID, '7', 'panel', [appt]);
    expect(result).toBeUndefined();
  });

  test('returns undefined when matching appointment is not active', () => {
    const appt = makeAppointment({ status: 'inactive' });
    const result = findMergeTarget(BASE_COURT_ID, '7', 'panel', [appt]);
    expect(result).toBeUndefined();
  });

  test('returns the matching active appointment', () => {
    const appt = makeAppointment();
    const result = findMergeTarget(BASE_COURT_ID, '7', 'panel', [appt]);
    expect(result).toBe(appt);
  });

  test('skips inactive appointments and finds the active one', () => {
    const inactive = makeAppointment({ id: 'appt-inactive', status: 'inactive' });
    const active = makeAppointment({ id: 'appt-active' });
    const result = findMergeTarget(BASE_COURT_ID, '7', 'panel', [inactive, active]);
    expect(result).toBe(active);
  });
});

// ──────────────────────────────────────────────
// buildMergeResult
// ──────────────────────────────────────────────

describe('buildMergeResult', () => {
  describe('when mergeTarget is undefined', () => {
    test('returns { type: "created" }', () => {
      const result = buildMergeResult(undefined, makePayload(), COURTS);
      expect(result).toEqual({ type: 'created' });
    });
  });

  describe('when mergeTarget is defined', () => {
    test('returns type "merged"', () => {
      const target = makeAppointment({ divisionCodes: ['301'] });
      const payload = makePayload({ divisionCodes: ['303'] });
      const result = buildMergeResult(target, payload, COURTS);
      expect(result.type).toBe('merged');
    });

    test('includes the target id', () => {
      const target = makeAppointment({ id: 'my-target-id', divisionCodes: ['301'] });
      const payload = makePayload({ divisionCodes: ['303'] });
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.targetId).toBe('my-target-id');
    });

    test('merges division codes and deduplicates them', () => {
      const target = makeAppointment({ divisionCodes: ['301', '303'] });
      const payload = makePayload({ divisionCodes: ['303', '310'] });
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      // 301 from target, 303 deduped, 310 added — exactly these three
      expect(result.payload.divisionCodes).toHaveLength(3);
      expect(result.payload.divisionCodes).toEqual(expect.arrayContaining(['301', '303', '310']));
    });

    test('sets divisionCode to the first element of the merged array', () => {
      const target = makeAppointment({ divisionCodes: ['301'] });
      const payload = makePayload({ divisionCodes: ['303'] });
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.divisionCode).toBe(result.payload.divisionCodes![0]);
    });

    test('resolves added division names from allCourts', () => {
      const target = makeAppointment({ divisionCodes: ['301'] });
      const payload = makePayload({ divisionCodes: ['303'] }); // St. Louis
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.addedNames).toEqual(['St. Louis']);
    });

    test('falls back to the raw division code when the code is not in allCourts', () => {
      const target = makeAppointment({ divisionCodes: ['301'] });
      const payload = makePayload({ divisionCodes: ['999'] }); // unknown code
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.addedNames).toEqual(['999']);
    });

    test('addedNames is empty when every payload division already exists in target', () => {
      const target = makeAppointment({ divisionCodes: ['301', '303'] });
      const payload = makePayload({ divisionCodes: ['301'] }); // already present
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.addedNames).toEqual([]);
    });

    test('spreads all other payload fields into the merged payload', () => {
      const target = makeAppointment({ divisionCodes: ['301'] });
      const payload = makePayload({
        divisionCodes: ['303'],
        appointedDate: '2022-06-15',
        effectiveDate: '2022-07-01',
        status: 'active',
      });
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.appointedDate).toBe('2022-06-15');
      expect(result.payload.effectiveDate).toBe('2022-07-01');
      expect(result.payload.status).toBe('active');
    });

    // ── divisionCodes ?? [divisionCode] branch ──

    test('uses legacy divisionCode when divisionCodes is absent on the target', () => {
      // mergeTarget has only divisionCode (no divisionCodes array)
      const target = makeAppointment({ divisionCodes: undefined, divisionCode: '301' });
      const payload = makePayload({ divisionCodes: ['303'] });
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.divisionCodes).toContain('301');
      expect(result.payload.divisionCodes).toContain('303');
    });

    test('filters out falsy entries when divisionCodes is absent and divisionCode is undefined', () => {
      // divisionCodes undefined, divisionCode undefined → existingDivisions should be []
      const target = makeAppointment({ divisionCodes: undefined, divisionCode: undefined });
      const payload = makePayload({ divisionCodes: ['303'] });
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      // only the payload division survives (no falsy entries from target)
      expect(result.payload.divisionCodes).toEqual(['303']);
    });

    test('handles multiple added divisions and resolves each name', () => {
      const target = makeAppointment({ divisionCodes: ['301'] }); // Springfield already present
      const payload = makePayload({ divisionCodes: ['303', '310'] }); // St. Louis + Cape Girardeau added
      const result = buildMergeResult(target, payload, COURTS);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.addedNames).toHaveLength(2);
      expect(result.addedNames).toEqual(expect.arrayContaining(['St. Louis', 'Cape Girardeau']));
    });
  });
});
