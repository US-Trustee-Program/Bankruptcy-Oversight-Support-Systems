import {
  formatAppointmentStatus,
  getStatusOptions,
  chapterAppointmentTypeMap,
  TRUSTEE_APPOINTMENTS_INTERNAL_SPEC,
  TrusteeAppointmentInput,
} from './trustee-appointments';
import { AppointmentChapterType, AppointmentType, AppointmentStatus } from './trustees';
import { validateObject } from './validation';

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

    test('should return default fallback for unknown combinations', () => {
      // This tests the fallback case
      const result = getStatusOptions('7' as AppointmentChapterType, 'standing' as AppointmentType);
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
        expect(result.valid).not.toBe(true);
        expect(result.reasonMap?.$?.reasons).toContain(
          'Appointment type "standing" is not valid for chapter 7',
        );
      });

      test('should fail validation when appointmentType pool is used for Chapter 7', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'pool' as AppointmentType,
          status: 'active',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).not.toBe(true);
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

      test('should fail validation when status is invalid for Chapter 7 panel', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'panel',
          status: 'deceased',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).not.toBe(true);
        expect(result.reasonMap?.$?.reasons).toContain(
          'Status "deceased" is not valid for chapter 7 with appointment type "panel"',
        );
      });

      test('should fail validation when status is invalid for Chapter 7 off-panel', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'off-panel',
          status: 'active',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).not.toBe(true);
        expect(result.reasonMap?.$?.reasons).toContain(
          'Status "active" is not valid for chapter 7 with appointment type "off-panel"',
        );
      });

      test('should fail validation when status is invalid for Chapter 11 Subchapter V pool', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '11-subchapter-v',
          appointmentType: 'pool',
          status: 'deceased',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).not.toBe(true);
        expect(result.reasonMap?.$?.reasons).toContain(
          'Status "deceased" is not valid for chapter 11-subchapter-v with appointment type "pool"',
        );
      });

      test('should fail validation when status removed is used for Chapter 7 panel', () => {
        const appointment: TrusteeAppointmentInput = {
          ...validAppointment,
          chapter: '7',
          appointmentType: 'panel',
          status: 'removed',
        };
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).not.toBe(true);
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
        expect(result.valid).not.toBe(true);
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

      test('should pass validation when chapter and appointmentType are missing', () => {
        const appointment = {
          ...validAppointment,
          chapter: undefined,
          appointmentType: undefined,
        } as unknown as TrusteeAppointmentInput;
        const result = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointment);
        expect(result.valid).toBe(true);
      });
    });
  });
});
