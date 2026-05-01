import { describe, test, expect } from 'vitest';
import {
  normalizeForComparison,
  splitMultiValue,
  copyAppointmentRecord,
} from './ats-cleansing-utils';
import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';

describe('ats-cleansing-utils', () => {
  describe('normalizeForComparison', () => {
    test('should normalize string to uppercase and trim whitespace', () => {
      expect(normalizeForComparison('  New York  ')).toBe('NEW YORK');
    });

    test('should return empty string for null', () => {
      expect(normalizeForComparison(null)).toBe('');
    });

    test('should return empty string for undefined', () => {
      expect(normalizeForComparison(undefined)).toBe('');
    });

    test('should return empty string for "NULL"', () => {
      expect(normalizeForComparison('NULL')).toBe('');
    });

    test('should handle mixed case', () => {
      expect(normalizeForComparison('nEw YoRk')).toBe('NEW YORK');
    });
  });

  describe('splitMultiValue', () => {
    test('should split on comma', () => {
      expect(splitMultiValue('081, 082, 083')).toEqual(['081', '082', '083']);
    });

    test('should split on slash', () => {
      expect(splitMultiValue('081/082/083')).toEqual(['081', '082', '083']);
    });

    test('should split on ampersand', () => {
      expect(splitMultiValue('081&082&083')).toEqual(['081', '082', '083']);
    });

    test('should split on "and"', () => {
      expect(splitMultiValue('081 and 082 and 083')).toEqual(['081', '082', '083']);
    });

    test('should handle mixed delimiters', () => {
      expect(splitMultiValue('081, 082/083 and 084')).toEqual(['081', '082', '083', '084']);
    });

    test('should return empty array for null', () => {
      expect(splitMultiValue(null)).toEqual([]);
    });

    test('should return empty array for undefined', () => {
      expect(splitMultiValue(undefined)).toEqual([]);
    });

    test('should return empty array for "NULL"', () => {
      expect(splitMultiValue('NULL')).toEqual([]);
    });

    test('should filter empty strings', () => {
      expect(splitMultiValue('081,,082')).toEqual(['081', '082']);
    });
  });

  describe('copyAppointmentRecord', () => {
    test('should create shallow copy of appointment record', () => {
      const original: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '081',
        STATE: 'NY',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2024-01-01'),
        STATUS: 'ACTIVE',
        EFFECTIVE_DATE: new Date('2024-01-01'),
      };

      const copy = copyAppointmentRecord(original);

      expect(copy).toEqual(original);
      expect(copy).not.toBe(original);
      expect(copy.TRU_ID).toBe(123);
      expect(copy.DISTRICT).toBe('081');
    });

    test('should not affect original when copy is modified', () => {
      const original: AtsAppointmentRecord = {
        TRU_ID: 123,
        DISTRICT: '081',
        STATE: 'NY',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2024-01-01'),
        STATUS: 'ACTIVE',
        EFFECTIVE_DATE: new Date('2024-01-01'),
      };

      const copy = copyAppointmentRecord(original);
      copy.DISTRICT = '082';

      expect(original.DISTRICT).toBe('081');
      expect(copy.DISTRICT).toBe('082');
    });
  });
});
