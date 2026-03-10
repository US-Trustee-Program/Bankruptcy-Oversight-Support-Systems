/**
 * Unit tests for ATS cleansing pipeline error handling and edge cases.
 *
 * These tests complement ats-cleansing-pipeline.test.ts (TSV validation tests)
 * by testing error branches, transform failures, and edge cases.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { cleanseAndMapAppointment } from './ats-cleansing-pipeline';
import { createMockApplicationContext } from '../../../../testing/testing-utilities';
import { ApplicationContext } from '../../../../adapters/types/basic';
import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';
import { CleansingClassification, TrusteeOverride } from './ats-cleansing-types';
import * as transform from './ats-cleansing-transform';

describe('ATS Cleansing Pipeline - Error Handling', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    vi.restoreAllMocks();
  });

  describe('cleanseAndMapAppointment', () => {
    test('should handle transform error in override MAP path', () => {
      const overridesCache = new Map<string, TrusteeOverride[]>();
      overridesCache.set('123', [
        {
          trusteeId: '123',
          status: 'PA',
          district: 'Middle',
          state: 'Louisiana',
          chapter: '7',
          action: 'MAP',
          overrideCourtId: '053N',
          notes: 'Test override',
        },
      ]);

      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 123,
        STATUS: 'PA',
        DISTRICT: 'Middle',
        STATE: 'Louisiana',
        CHAPTER: '7',
      };

      // Mock transform to throw error
      vi.spyOn(transform, 'transformAppointmentRecord').mockImplementation(() => {
        throw new Error('Transform failed');
      });

      const result = cleanseAndMapAppointment(context, '123', atsAppointment, overridesCache);

      expect(result.classification).toBe(CleansingClassification.UNCLEANSABLE);
      expect(result.courtIds).toEqual([]);
      expect(result.mapType).toBe('UNMAPPED');
      expect(result.notes.some((n) => n.includes('Transform error'))).toBe(true);
    });

    test('should handle transform error in normal cleansing path', () => {
      const overridesCache = new Map<string, TrusteeOverride[]>();

      // Valid appointment that would normally cleanse successfully
      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 456,
        STATUS: 'PA',
        DISTRICT: 'Middle',
        STATE: 'Louisiana',
        CHAPTER: '7',
        DATE_APPOINTED: new Date('2023-01-15'),
        EFFECTIVE_DATE: new Date('2023-01-15'),
      };

      // Mock transform to throw error
      vi.spyOn(transform, 'transformAppointmentRecord').mockImplementation(() => {
        throw new Error('Transform validation failed');
      });

      const result = cleanseAndMapAppointment(context, '456', atsAppointment, overridesCache);

      expect(result.classification).toBe(CleansingClassification.UNCLEANSABLE);
      expect(result.courtIds).toEqual([]);
      expect(result.mapType).toBe('UNMAPPED');
      expect(result.notes.some((n) => n.includes('Transform error'))).toBe(true);
    });

    test('should handle unexpected errors in pipeline', () => {
      const overridesCache = new Map<string, TrusteeOverride[]>();

      // Create an appointment that will cause an error in the pipeline
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atsAppointment = null as any; // Force an error

      const result = cleanseAndMapAppointment(context, '789', atsAppointment, overridesCache);

      expect(result.classification).toBe(CleansingClassification.UNCLEANSABLE);
      expect(result.courtIds).toEqual([]);
      expect(result.mapType).toBe('UNMAPPED');
      expect(result.notes.some((n) => n.includes('Pipeline error'))).toBe(true);
    });

    test('should return SKIP result from override without transform', () => {
      const overridesCache = new Map<string, TrusteeOverride[]>();
      overridesCache.set('999', [
        {
          trusteeId: '999',
          status: 'NP',
          district: 'test',
          state: 'testt',
          chapter: '7',
          action: 'SKIP',
          notes: 'Test data - exclude',
        },
      ]);

      const atsAppointment: AtsAppointmentRecord = {
        TRU_ID: 999,
        STATUS: 'NP',
        DISTRICT: 'test',
        STATE: 'testt',
        CHAPTER: '7',
      };

      const result = cleanseAndMapAppointment(context, '999', atsAppointment, overridesCache);

      expect(result.classification).toBe(CleansingClassification.SKIP);
      expect(result.skip).toBe(true);
      expect(result.courtIds).toEqual([]);
      expect(result.mapType).toBe('OVERRIDE:SKIP');
    });
  });

  // Note: loadTrusteeOverrides tests using fs mocking are not feasible with ES modules
  // The file I/O error paths are tested integration-style in ats-cleansing-pipeline.test.ts
});
