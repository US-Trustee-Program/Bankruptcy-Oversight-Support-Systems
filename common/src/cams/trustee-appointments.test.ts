import {
  formatAppointmentStatus,
  getStatusOptions,
  chapterAppointmentTypeMap,
  TRUSTEE_APPOINTMENTS_INTERNAL_SPEC,
  TrusteeAppointmentInput,
  TrusteeAppointment,
  isChapter12Standing,
  isChapter13Standing,
  isChapter7Elected,
  findMergeTarget,
  buildMergePayload,
  getDivisionCodes,
  isChapter11CaseByCase,
  isChapter11SubchapterV,
  isChapter12Or13CaseByCase,
  isChapter7Panel,
  isChapter7OffPanel,
  isChapter7Converted,
} from './trustee-appointments';
import { AppointmentChapterType, AppointmentType, AppointmentStatus } from './trustees';
import { validateObject } from './validation';

const BASE_COURT_ID = '081-';

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

describe('trustee-appointments', () => {
  describe('formatAppointmentStatus', () => {
    test.each([
      ['active', 'Active'],
      ['inactive', 'Inactive'],
      ['voluntarily-suspended', 'Voluntarily Suspended'],
      ['involuntarily-suspended', 'Involuntarily Suspended'],
      ['deceased', 'Deceased'],
      ['resigned', 'Resigned'],
      ['terminated', 'Terminated'],
      ['removed', 'Removed'],
    ])('should format "%s" as "%s"', (input, expected) => {
      expect(formatAppointmentStatus(input as AppointmentStatus)).toBe(expected);
    });
  });

  describe('getStatusOptions', () => {
    describe('Chapter 7', () => {
      test('should return correct status options for panel', () => {
        const result = getStatusOptions('7', 'panel');
        expect(result).toEqual(['active', 'voluntarily-suspended', 'involuntarily-suspended']);
      });

      test('should return correct status options for off-panel', () => {
        const result = getStatusOptions('7', 'off-panel');
        expect(result).toEqual(['deceased', 'resigned', 'terminated']);
      });

      test('should return correct status options for elected', () => {
        const result = getStatusOptions('7', 'elected');
        expect(result).toEqual(['active', 'inactive']);
      });

      test('should return correct status options for converted-case', () => {
        const result = getStatusOptions('7', 'converted-case');
        expect(result).toEqual(['active', 'inactive']);
      });
    });

    describe('Chapter 11', () => {
      test('should return correct status options for case-by-case', () => {
        const result = getStatusOptions('11', 'case-by-case');
        expect(result).toEqual(['active', 'inactive']);
      });
    });

    describe('Chapter 11 Subchapter V', () => {
      test('should return correct status options for pool', () => {
        const result = getStatusOptions('11-subchapter-v', 'pool');
        expect(result).toEqual(['active']);
      });

      test('should return correct status options for out-of-pool', () => {
        const result = getStatusOptions('11-subchapter-v', 'out-of-pool');
        expect(result).toEqual(['deceased', 'removed', 'resigned']);
      });
    });

    describe('Chapter 12', () => {
      test('should return correct status options for standing', () => {
        const result = getStatusOptions('12', 'standing');
        expect(result).toEqual(['active', 'deceased', 'resigned', 'terminated']);
      });

      test('should return correct status options for case-by-case', () => {
        const result = getStatusOptions('12', 'case-by-case');
        expect(result).toEqual(['active', 'inactive']);
      });
    });

    describe('Chapter 13', () => {
      test('should return correct status options for standing', () => {
        const result = getStatusOptions('13', 'standing');
        expect(result).toEqual(['active', 'deceased', 'resigned', 'terminated']);
      });

      test('should return correct status options for case-by-case', () => {
        const result = getStatusOptions('13', 'case-by-case');
        expect(result).toEqual(['active', 'inactive']);
      });
    });

    test('should return default fallback when appointmentType has no configured statuses', () => {
      const result = getStatusOptions('7' as AppointmentChapterType, 'standing' as AppointmentType);
      expect(result).toEqual(['active', 'inactive']);
    });

    test('should return default fallback for an unrecognized chapter, not throw', () => {
      // AppointmentChapterType is a closed union at compile time, but this runs against
      // untrusted input cast from an HTTP request body at runtime -- an out-of-range chapter
      // must fail safely, not throw on an undefined lookup.
      const result = getStatusOptions('99' as AppointmentChapterType, 'panel');
      expect(result).toEqual(['active', 'inactive']);
    });
  });

  describe('chapterAppointmentTypeMap', () => {
    test('should include new appointment types for Chapter 7', () => {
      const chapter7Types = chapterAppointmentTypeMap['7'];
      expect(chapter7Types).toContain('panel');
      expect(chapter7Types).toContain('off-panel');
      expect(chapter7Types).toContain('elected');
      expect(chapter7Types).toContain('converted-case');
      expect(chapter7Types).toHaveLength(4);
    });

    test('should have correct appointment types for Chapter 11', () => {
      const chapter11Types = chapterAppointmentTypeMap['11'];
      expect(chapter11Types).toEqual(['case-by-case']);
    });

    test('should have correct appointment types for Chapter 11 Subchapter V', () => {
      const chapter11SubVTypes = chapterAppointmentTypeMap['11-subchapter-v'];
      expect(chapter11SubVTypes).toEqual(['pool', 'out-of-pool']);
    });

    test('should have correct appointment types for Chapter 12', () => {
      const chapter12Types = chapterAppointmentTypeMap['12'];
      expect(chapter12Types).toEqual(['standing', 'case-by-case']);
    });

    test('should have correct appointment types for Chapter 13', () => {
      const chapter13Types = chapterAppointmentTypeMap['13'];
      expect(chapter13Types).toEqual(['standing', 'case-by-case']);
    });
  });

  describe('TRUSTEE_APPOINTMENTS_INTERNAL_SPEC', () => {
    const validAppointment: TrusteeAppointmentInput = {
      chapter: '7',
      appointmentType: 'panel',
      status: 'active',
      courtId: 'court-001',
      divisionCode: '081',
      appointedDate: '2024-01-01',
      effectiveDate: '2024-01-01',
    };

    describe('valid appointmentType for chapter', () => {
      test('should pass validation when appointmentType is valid for Chapter 7', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'panel',
          status: 'active',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should pass validation when appointmentType is valid for Chapter 11', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '11',
          appointmentType: 'case-by-case',
          status: 'active',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should fail validation when appointmentType is invalid for chapter', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'standing' as AppointmentType,
          status: 'active',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBeUndefined();
        expect(result.reasonMap?.$?.reasons).toContain(
          'Appointment type "standing" is not valid for chapter 7',
        );
      });

      test('should fail validation cleanly (not throw) when chapter is not a recognized value', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '99' as AppointmentChapterType,
          appointmentType: 'panel',
          status: 'active',
        };
        expect(() => validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment)).not.toThrow();
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBeUndefined();
      });

      test('should fail validation when appointmentType pool is used for Chapter 7', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'pool' as AppointmentType,
          status: 'active',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBeUndefined();
        expect(result.reasonMap?.$?.reasons).toContain(
          'Appointment type "pool" is not valid for chapter 7',
        );
      });
    });

    describe('valid status for chapter and appointmentType', () => {
      test('should pass validation when status is valid for Chapter 7 panel', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'panel',
          status: 'voluntarily-suspended',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should pass validation when status is valid for Chapter 7 off-panel', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'off-panel',
          status: 'deceased',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should pass validation when status is valid for Chapter 11 Subchapter V pool', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '11-subchapter-v',
          appointmentType: 'pool',
          status: 'active',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test.each([
        [
          'Chapter 7 panel',
          '7',
          'panel',
          'deceased',
          'Status "deceased" is not valid for chapter 7 with appointment type "panel"',
        ],
        [
          'Chapter 7 off-panel',
          '7',
          'off-panel',
          'active',
          'Status "active" is not valid for chapter 7 with appointment type "off-panel"',
        ],
        [
          'Chapter 11 Subchapter V pool',
          '11-subchapter-v',
          'pool',
          'deceased',
          'Status "deceased" is not valid for chapter 11-subchapter-v with appointment type "pool"',
        ],
      ])(
        'should fail validation when status is invalid for %s',
        (_desc, chapter, appointmentType, status, expectedMessage) => {
          const appointment: TrusteeAppointmentInput = {
            ...validAppointment,
            chapter: chapter as AppointmentChapterType,
            appointmentType: appointmentType as AppointmentType,
            status: status as AppointmentStatus,
          };
          const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
          expect(result.valid).toBeUndefined();
          expect(result.reasonMap?.$?.reasons).toContain(expectedMessage);
        },
      );

      test('should fail validation when status removed is used for Chapter 7 panel', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'panel',
          status: 'removed',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBeUndefined();
        expect(result.reasonMap?.$?.reasons).toContain(
          'Status "removed" is not valid for chapter 7 with appointment type "panel"',
        );
      });
    });

    describe('combined validation', () => {
      test('should report both errors when both appointmentType and status are invalid', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'standing' as AppointmentType,
          status: 'removed',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBeUndefined();
        expect(result.reasonMap?.$?.reasons).toContain(
          'Appointment type "standing" is not valid for chapter 7',
        );
        expect(result.reasonMap?.$?.reasons).toContain(
          'Status "removed" is not valid for chapter 7 with appointment type "standing"',
        );
      });
    });

    describe('edge cases', () => {
      test('should pass validation for Chapter 13 standing with status active', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '13',
          appointmentType: 'standing',
          status: 'active',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should pass validation for Chapter 12 case-by-case with status inactive', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '12',
          appointmentType: 'case-by-case',
          status: 'inactive',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should pass validation when chapter is missing', () => {
        const appointment = {
          ...validAppointment,
          chapter: undefined,
        } as unknown as TrusteeAppointmentInput;
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should pass validation when appointmentType is missing', () => {
        const appointment = {
          ...validAppointment,
          appointmentType: undefined,
        } as unknown as TrusteeAppointmentInput;
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should pass validation when status is missing', () => {
        const appointment = {
          ...validAppointment,
          status: undefined,
        } as unknown as TrusteeAppointmentInput;
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });
    });

    describe('optional enrichment fields', () => {
      test('should accept TrusteeAppointmentInput with courtName', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          courtName: 'United States Bankruptcy Court',
        };
        expect(appointment.courtName).toBe('United States Bankruptcy Court');
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should accept TrusteeAppointmentInput with courtDivisionName', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          courtDivisionName: 'Manhattan Office',
        };
        expect(appointment.courtDivisionName).toBe('Manhattan Office');
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should accept TrusteeAppointmentInput with both court enrichment fields', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          courtName: 'United States Bankruptcy Court',
          courtDivisionName: 'Manhattan Office',
        };
        expect(appointment.courtName).toBe('United States Bankruptcy Court');
        expect(appointment.courtDivisionName).toBe('Manhattan Office');
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });
    });

    describe('division code validation', () => {
      test('should fail when neither divisionCode nor divisionCodes is provided', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          divisionCode: undefined,
          divisionCodes: undefined,
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBeUndefined();
        expect(result.reasonMap?.$?.reasons).toContain('At least one division must be specified');
      });

      test('should fail when divisionCode is empty and divisionCodes is empty', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          divisionCode: '',
          divisionCodes: [],
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBeUndefined();
        expect(result.reasonMap?.$?.reasons).toContain('At least one division must be specified');
      });

      test('should fail when divisionCodes contains only whitespace entries', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          divisionCode: undefined,
          divisionCodes: ['  ', '', '   '],
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBeUndefined();
        expect(result.reasonMap?.$?.reasons).toContain('At least one division must be specified');
      });

      test('should pass when divisionCode is set but divisionCodes is empty', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          divisionCode: '081',
          divisionCodes: [],
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });

      test('should pass when divisionCodes has entries but divisionCode is absent', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          divisionCode: undefined,
          divisionCodes: ['081', '082'],
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('isChapter12Standing', () => {
    test('returns true for chapter 12 standing', () => {
      expect(isChapter12Standing('12', 'standing')).toBe(true);
    });

    test.each([
      ['12', 'case-by-case'],
      ['13', 'standing'],
      ['7', 'panel'],
      ['12', ''],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(isChapter12Standing(chapter as AppointmentChapterType, type as AppointmentType)).toBe(
        false,
      );
    });
  });

  describe('isChapter13Standing', () => {
    test('returns true for chapter 13 standing', () => {
      expect(isChapter13Standing('13', 'standing')).toBe(true);
    });

    test.each([
      ['13', 'case-by-case'],
      ['12', 'standing'],
      ['7', 'panel'],
      ['13', ''],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(isChapter13Standing(chapter as AppointmentChapterType, type as AppointmentType)).toBe(
        false,
      );
    });
  });

  describe('isChapter7Elected', () => {
    test('returns true for chapter 7 elected', () => {
      expect(isChapter7Elected('7', 'elected')).toBe(true);
    });

    test.each([
      ['7', 'panel'],
      ['12', 'elected'],
      ['13', 'standing'],
      ['7', ''],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(isChapter7Elected(chapter as AppointmentChapterType, type as AppointmentType)).toBe(
        false,
      );
    });
  });

  describe('getDivisionCodes', () => {
    test('returns divisionCodes when present', () => {
      expect(getDivisionCodes({ divisionCodes: ['301', '303'] })).toEqual(['301', '303']);
    });

    test('falls back to the legacy divisionCode when divisionCodes is absent', () => {
      expect(getDivisionCodes({ divisionCode: '301' })).toEqual(['301']);
    });

    test('returns an empty array when both divisionCodes and divisionCode are absent', () => {
      expect(getDivisionCodes({})).toEqual([]);
    });

    test('does not fall back to divisionCode when divisionCodes is an explicit empty array', () => {
      expect(getDivisionCodes({ divisionCodes: [], divisionCode: '301' })).toEqual([]);
    });
  });

  describe('findMergeTarget', () => {
    test('returns undefined when the list is empty', () => {
      expect(findMergeTarget(BASE_COURT_ID, '7', 'panel', 'active', [])).toBeUndefined();
    });

    test('returns undefined when no appointment matches court/chapter/type', () => {
      const appt = makeAppointment({ courtId: '097-' });
      expect(findMergeTarget(BASE_COURT_ID, '7', 'panel', 'active', [appt])).toBeUndefined();
    });

    test('returns undefined when the matching appointment is not active', () => {
      const appt = makeAppointment({ status: 'inactive' });
      expect(findMergeTarget(BASE_COURT_ID, '7', 'panel', 'active', [appt])).toBeUndefined();
    });

    test('returns the matching active appointment, skipping inactive ones', () => {
      const inactive = makeAppointment({ id: 'appt-inactive', status: 'inactive' });
      const active = makeAppointment({ id: 'appt-active' });
      expect(findMergeTarget(BASE_COURT_ID, '7', 'panel', 'active', [inactive, active])).toBe(
        active,
      );
    });

    test('has no built-in self-exclusion -- a caller must filter out the appointment being updated itself', () => {
      // findMergeTarget itself has no notion of "the appointment being updated": passed its
      // own unfiltered active appointment, it matches itself. An update path must exclude
      // that appointment from existingAppointments before calling this, or it would
      // spuriously detect a self-duplicate -- this test proves the exclusion is the caller's
      // responsibility, not something this function does for you.
      const self = makeAppointment({ id: 'self' });
      expect(findMergeTarget(BASE_COURT_ID, '7', 'panel', 'active', [self])).toBe(self);
    });

    test.each(['inactive', 'voluntarily-suspended', 'deceased', 'resigned'] as AppointmentStatus[])(
      'returns undefined when the incoming status is %s, even if a matching active appointment exists',
      (incomingStatus) => {
        const active = makeAppointment({ id: 'appt-active' });
        expect(
          findMergeTarget(BASE_COURT_ID, '7', 'panel', incomingStatus, [active]),
        ).toBeUndefined();
      },
    );

    test('returns undefined when chapter differs, even with matching court and appointmentType', () => {
      const appt = makeAppointment({ chapter: '11', appointmentType: 'panel' });
      expect(findMergeTarget(BASE_COURT_ID, '7', 'panel', 'active', [appt])).toBeUndefined();
    });

    test('returns undefined when appointmentType differs, even with matching court and chapter', () => {
      const appt = makeAppointment({ chapter: '7', appointmentType: 'off-panel' });
      expect(findMergeTarget(BASE_COURT_ID, '7', 'panel', 'active', [appt])).toBeUndefined();
    });
  });

  describe('buildMergePayload', () => {
    test('returns { type: "created" } when there is no merge target', () => {
      expect(buildMergePayload(undefined, makePayload())).toEqual({ type: 'created' });
    });

    test('merges division codes and deduplicates them', () => {
      const target = makeAppointment({ divisionCodes: ['301', '303'] });
      const payload = makePayload({ divisionCodes: ['303', '310'] });
      const result = buildMergePayload(target, payload);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.divisionCodes).toHaveLength(3);
      expect(result.payload.divisionCodes).toEqual(expect.arrayContaining(['301', '303', '310']));
    });

    test('sets divisionCode to the first element of the merged array', () => {
      const target = makeAppointment({ divisionCodes: ['301'] });
      const payload = makePayload({ divisionCodes: ['303'] });
      const result = buildMergePayload(target, payload);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.divisionCode).toBe(result.payload.divisionCodes![0]);
    });

    test('reports only the newly-added division codes, not codes already on the target', () => {
      const target = makeAppointment({ divisionCodes: ['301', '303'] });
      const payload = makePayload({ divisionCodes: ['303', '310'] });
      const result = buildMergePayload(target, payload);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.addedDivisionCodes).toEqual(['310']);
    });

    test('uses legacy divisionCode when divisionCodes is absent on the target', () => {
      const target = makeAppointment({ divisionCodes: undefined, divisionCode: '301' });
      const payload = makePayload({ divisionCodes: ['303'] });
      const result = buildMergePayload(target, payload);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.divisionCodes).toEqual(expect.arrayContaining(['301', '303']));
    });

    test('tolerates a payload with no divisionCodes at all, merging in nothing new', () => {
      // A legacy caller could in principle omit divisionCodes entirely (the type permits it,
      // even though both current callers normalize it in first) -- this proves that path
      // doesn't throw and simply contributes no new divisions, rather than exercising only
      // the common case where payload.divisionCodes is always set.
      const target = makeAppointment({ divisionCodes: ['301'] });
      const payload = makePayload({ divisionCodes: undefined, divisionCode: undefined });
      const result = buildMergePayload(target, payload);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.divisionCodes).toEqual(['301']);
      expect(result.addedDivisionCodes).toEqual([]);
    });

    test('includes the target id', () => {
      const target = makeAppointment({ id: 'my-target-id' });
      const result = buildMergePayload(target, makePayload());
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.targetId).toBe('my-target-id');
    });

    test("preserves the merge target's own appointedDate/status/effectiveDate rather than the incoming payload's", () => {
      // Only division codes are meant to be unioned -- every other field belongs to the
      // pre-existing target record and must survive the merge untouched, even though the
      // incoming payload (the record being redirected away from) carries different values.
      const target = makeAppointment({
        divisionCodes: ['301'],
        appointedDate: '2020-01-01',
        status: 'active',
        effectiveDate: '2020-01-01',
      });
      const payload = makePayload({
        divisionCodes: ['303'],
        appointedDate: '2022-06-15',
        status: 'active',
        effectiveDate: '2022-07-01',
      });
      const result = buildMergePayload(target, payload);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.appointedDate).toBe('2020-01-01');
      expect(result.payload.status).toBe('active');
      expect(result.payload.effectiveDate).toBe('2020-01-01');
    });

    test("preserves the merge target's own courtName/courtDivisionName", () => {
      const target = makeAppointment({
        divisionCodes: ['301'],
        courtName: 'Target District',
        courtDivisionName: 'Target Division',
      });
      const payload = makePayload({
        divisionCodes: ['303'],
        courtName: 'Incoming District',
        courtDivisionName: 'Incoming Division',
      });
      const result = buildMergePayload(target, payload);
      if (result.type !== 'merged') throw new Error('expected merged');
      expect(result.payload.courtName).toBe('Target District');
      expect(result.payload.courtDivisionName).toBe('Target Division');
    });
  });

  describe('isChapter11CaseByCase', () => {
    test('returns true for chapter 11 case-by-case', () => {
      expect(isChapter11CaseByCase('11', 'case-by-case')).toBe(true);
    });

    test.each([
      ['11', 'panel'],
      ['12', 'case-by-case'],
      ['13', 'panel'],
      ['11', ''],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(
        isChapter11CaseByCase(chapter as AppointmentChapterType, type as AppointmentType),
      ).toBe(false);
    });
  });

  describe('isChapter12Or13CaseByCase', () => {
    test.each([
      ['12', 'case-by-case'],
      ['13', 'case-by-case'],
    ])('returns true for chapter %s / %s', (chapter, type) => {
      expect(
        isChapter12Or13CaseByCase(chapter as AppointmentChapterType, type as AppointmentType),
      ).toBe(true);
    });

    test.each([
      ['12', 'standing'],
      ['13', 'standing'],
      ['11', 'case-by-case'],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(
        isChapter12Or13CaseByCase(chapter as AppointmentChapterType, type as AppointmentType),
      ).toBe(false);
    });
  });

  describe('isChapter7Panel', () => {
    test('returns true for chapter 7 panel', () => {
      expect(isChapter7Panel('7', 'panel')).toBe(true);
    });

    test.each([
      ['7', 'elected'],
      ['12', 'panel'],
      ['13', 'standing'],
      ['7', ''],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(isChapter7Panel(chapter as AppointmentChapterType, type as AppointmentType)).toBe(
        false,
      );
    });
  });

  describe('isChapter7OffPanel', () => {
    test('returns true for chapter 7 off-panel', () => {
      expect(isChapter7OffPanel('7', 'off-panel')).toBe(true);
    });

    test.each([
      ['7', 'panel'],
      ['7', 'converted-case'],
      ['12', 'off-panel'],
      ['7', ''],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(isChapter7OffPanel(chapter as AppointmentChapterType, type as AppointmentType)).toBe(
        false,
      );
    });
  });

  describe('isChapter7Converted', () => {
    test('returns true for chapter 7 converted-case', () => {
      expect(isChapter7Converted('7', 'converted-case')).toBe(true);
    });

    test.each([
      ['7', 'panel'],
      ['7', 'off-panel'],
      ['12', 'converted-case'],
      ['7', ''],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(isChapter7Converted(chapter as AppointmentChapterType, type as AppointmentType)).toBe(
        false,
      );
    });
  });

  describe('isChapter11SubchapterV', () => {
    test.each([['pool'], ['out-of-pool']])(
      'returns true for chapter 11-subchapter-v %s',
      (type) => {
        expect(isChapter11SubchapterV('11-subchapter-v', type as AppointmentType)).toBe(true);
      },
    );

    test.each([
      ['11', 'pool'],
      ['11', 'out-of-pool'],
      ['13', 'standing'],
      ['11-subchapter-v', ''],
    ])('returns false for chapter %s / %s', (chapter, type) => {
      expect(
        isChapter11SubchapterV(chapter as AppointmentChapterType, type as AppointmentType),
      ).toBe(false);
    });
  });
});
