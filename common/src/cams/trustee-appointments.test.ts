import {
  formatAppointmentStatus,
  getStatusOptions,
  chapterAppointmentTypeMap,
} from './trustee-appointments';
import { AppointmentChapterType, AppointmentType, AppointmentStatus } from './trustees';

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
});
