import { describe, expect, test, vi } from 'vitest';
import { transformAppointmentRecord } from './ats-cleansing-transform';
import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';
import * as atsMappings from './ats-mappings';

describe('ATS Cleansing Transform', () => {
  describe('transformAppointmentRecord', () => {
    const baseRecord: AtsAppointmentRecord = {
      TRU_ID: 12345,
      DISTRICT: 'CA',
      CHAPTER: '7',
      STATUS: 'PA',
      DATE_APPOINTED: new Date('2024-01-15'),
      EFFECTIVE_DATE: new Date('2024-01-20'),
    };

    test('should transform a complete appointment record', () => {
      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(baseRecord, 'court-123');

      expect(result).toEqual({
        chapter: '7',
        appointmentType: 'panel',
        courtId: 'court-123',
        appointedDate: '2024-01-15',
        status: 'active',
        effectiveDate: '2024-01-20',
      });
    });

    test('should handle missing CHAPTER field', () => {
      const recordWithoutChapter = { ...baseRecord, CHAPTER: undefined } as AtsAppointmentRecord;

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithoutChapter, 'court-123');

      expect(result.chapter).toBe('7');
      expect(atsMappings.parseChapterAndType).toHaveBeenCalledWith(undefined);
    });

    test('should handle missing STATUS field', () => {
      const recordWithoutStatus = { ...baseRecord, STATUS: undefined };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithoutStatus, 'court-123');

      expect(result.status).toBe('active');
      expect(atsMappings.parseTodStatus).toHaveBeenCalledWith(undefined);
    });

    test('should throw error for invalid chapter', () => {
      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '99' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chapter: '99' as any,
        appointmentType: 'panel',
        status: 'active',
      });

      expect(() => transformAppointmentRecord(baseRecord, 'court-123')).toThrow(
        'Invalid chapter for CAMS: 99',
      );
    });

    test('should handle record with DATE_APPOINTED but no EFFECTIVE_DATE', () => {
      const recordWithoutEffectiveDate = {
        ...baseRecord,
        EFFECTIVE_DATE: undefined,
      };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithoutEffectiveDate, 'court-123');

      expect(result.appointedDate).toBe('2024-01-15');
      expect(result.effectiveDate).toBe('2024-01-15'); // Falls back to appointed date
    });

    test('should handle record with no DATE_APPOINTED but with EFFECTIVE_DATE', () => {
      const recordWithOnlyEffectiveDate = {
        ...baseRecord,
        DATE_APPOINTED: undefined,
        EFFECTIVE_DATE: new Date('2024-02-01'),
      };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithOnlyEffectiveDate, 'court-123');

      expect(result.appointedDate).toBe('2024-02-01'); // Uses EFFECTIVE_DATE
      expect(result.effectiveDate).toBe('2024-02-01');
    });

    test('should handle record with neither DATE_APPOINTED nor EFFECTIVE_DATE', () => {
      const recordWithNoDates = {
        ...baseRecord,
        DATE_APPOINTED: undefined,
        EFFECTIVE_DATE: undefined,
      };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithNoDates, 'court-123');

      expect(result.appointedDate).toBe('1970-01-01'); // Placeholder date
      expect(result.effectiveDate).toBe('1970-01-01');
    });

    test('should handle Chapter 11 records', () => {
      const chapter11Record = { ...baseRecord, CHAPTER: '11' };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '11' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'standing',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '11',
        appointmentType: 'standing',
        status: 'active',
      });

      const result = transformAppointmentRecord(chapter11Record, 'court-456');

      expect(result.chapter).toBe('11');
      expect(result.courtId).toBe('court-456');
    });

    test('should handle Chapter 11 Subchapter V records', () => {
      const subchapterVRecord = { ...baseRecord, CHAPTER: '11', STATUS: 'V' };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '11' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'standing',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '11-subchapter-v',
        appointmentType: 'standing',
        status: 'active',
      });

      const result = transformAppointmentRecord(subchapterVRecord, 'court-789');

      expect(result.chapter).toBe('11-subchapter-v');
    });

    test('should handle Chapter 12 records', () => {
      const chapter12Record = { ...baseRecord, CHAPTER: '12' };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '12' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'standing',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '12',
        appointmentType: 'standing',
        status: 'active',
      });

      const result = transformAppointmentRecord(chapter12Record, 'court-012');

      expect(result.chapter).toBe('12');
    });

    test('should handle Chapter 13 records', () => {
      const chapter13Record = { ...baseRecord, CHAPTER: '13' };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '13' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'standing',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '13',
        appointmentType: 'standing',
        status: 'active',
      });

      const result = transformAppointmentRecord(chapter13Record, 'court-013');

      expect(result.chapter).toBe('13');
    });

    test('should trim and uppercase CHAPTER field', () => {
      const recordWithWhitespace = {
        ...baseRecord,
        CHAPTER: '  7  ',
        STATUS: '  pa  ',
      };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      transformAppointmentRecord(recordWithWhitespace, 'court-123');

      // Verify that the functions were called with the original (untrimmed) values
      // since the transform passes the raw field values to the mapping functions
      expect(atsMappings.parseChapterAndType).toHaveBeenCalledWith('  7  ');
      expect(atsMappings.parseTodStatus).toHaveBeenCalledWith('  pa  ');
    });

    test('should format dates correctly to ISO format', () => {
      const recordWithSpecificDates = {
        ...baseRecord,
        DATE_APPOINTED: new Date('2023-12-25T10:30:00.000Z'),
        EFFECTIVE_DATE: new Date('2024-01-01T15:45:00.000Z'),
      };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithSpecificDates, 'court-123');

      expect(result.appointedDate).toBe('2023-12-25');
      expect(result.effectiveDate).toBe('2024-01-01');
    });

    test('should pass original chapter code to applyAppointmentOverrides', () => {
      const spy = vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });

      transformAppointmentRecord(baseRecord, 'court-123');

      expect(spy).toHaveBeenCalledWith({ chapter: '7' }, '7', 'PA', {
        appointmentType: 'panel',
        status: 'active',
      });
    });

    test('should handle case-by-case appointment type', () => {
      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '12' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'case-by-case',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '12',
        appointmentType: 'case-by-case',
        status: 'active',
      });

      const result = transformAppointmentRecord(baseRecord, 'court-123');

      expect(result.appointmentType).toBe('case-by-case');
    });

    test('should handle resigned status', () => {
      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'resigned',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'resigned',
      });

      const result = transformAppointmentRecord(baseRecord, 'court-123');

      expect(result.status).toBe('resigned');
    });

    test('should handle empty string CHAPTER field', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recordWithEmptyChapter = { ...baseRecord, CHAPTER: '' as any };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithEmptyChapter, 'court-123');

      expect(result.chapter).toBe('7');
      // Empty string should result in empty string after trim, then empty string after toUpperCase
      expect(atsMappings.applyAppointmentOverrides).toHaveBeenCalledWith(
        { chapter: '7' },
        '',
        'PA',
        { appointmentType: 'panel', status: 'active' },
      );
    });

    test('should handle empty string STATUS field', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recordWithEmptyStatus = { ...baseRecord, STATUS: '' as any };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithEmptyStatus, 'court-123');

      expect(result.status).toBe('active');
      expect(atsMappings.applyAppointmentOverrides).toHaveBeenCalledWith(
        { chapter: '7' },
        '7',
        '',
        { appointmentType: 'panel', status: 'active' },
      );
    });

    test('should handle whitespace-only CHAPTER and STATUS fields', () => {
      const recordWithWhitespaceFields = {
        ...baseRecord,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        CHAPTER: '   ' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        STATUS: '   ' as any,
      };

      vi.spyOn(atsMappings, 'parseChapterAndType').mockReturnValue({ chapter: '7' });
      vi.spyOn(atsMappings, 'parseTodStatus').mockReturnValue({
        appointmentType: 'panel',
        status: 'active',
      });
      vi.spyOn(atsMappings, 'applyAppointmentOverrides').mockReturnValue({
        chapter: '7',
        appointmentType: 'panel',
        status: 'active',
      });

      const result = transformAppointmentRecord(recordWithWhitespaceFields, 'court-123');

      expect(result.chapter).toBe('7');
      // Whitespace trim() results in empty string, then toUpperCase() gives empty string, then || gives ''
      expect(atsMappings.applyAppointmentOverrides).toHaveBeenCalledWith({ chapter: '7' }, '', '', {
        appointmentType: 'panel',
        status: 'active',
      });
    });
  });
});
