import { describe, test, expect } from 'vitest';
import { CourtDivisionDetails } from '@common/cams/courts';
import {
  TrusteeAppointment,
  TrusteeAppointmentInput,
  findMergeTarget as commonFindMergeTarget,
} from '@common/cams/trustee-appointments';
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

// This module only re-exports common/src/cams/trustee-appointments.ts's findMergeTarget --
// its own matching/active/status logic is exhaustively tested there against the same function
// object. A smoke test here just proves the re-export is wired correctly; the full behavior
// matrix belongs in common's own test suite, not duplicated here.
describe('findMergeTarget', () => {
  test('re-exports the same function as common/src/cams/trustee-appointments', () => {
    expect(findMergeTarget).toBe(commonFindMergeTarget);
  });
});

// ──────────────────────────────────────────────
// buildMergeResult
// ──────────────────────────────────────────────

// buildMergeResult's only unique responsibility is resolving human-readable division names via
// allCourts/getDivisionsForDistrict (see appointmentMergeHelpers.ts's own doc comment) -- the
// duplicate-detection and division-merge logic itself lives in common's buildMergePayload and
// is exhaustively tested there. These tests cover only this wrapper's own value-add: name
// resolution and the created/merged passthrough.
describe('buildMergeResult', () => {
  describe('when mergeTarget is undefined', () => {
    test('returns { type: "created" }', () => {
      const result = buildMergeResult(undefined, makePayload(), COURTS);
      expect(result).toEqual({ type: 'created' });
    });
  });

  describe('when mergeTarget is defined', () => {
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
