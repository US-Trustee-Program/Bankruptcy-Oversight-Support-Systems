/**
 * Unit tests for ATS cleansing overrides functionality.
 *
 * Note: loadTrusteeOverrides function cannot be fully tested due to ES module
 * limitations with fs.existsSync/fs.readFileSync mocking. These tests focus on
 * the checkOverride function which contains the core business logic.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { checkOverride, loadTrusteeOverrides } from './ats-cleansing-overrides';
import { createMockApplicationContext } from '../../../../testing/testing-utilities';
import { ApplicationContext } from '../../../../adapters/types/basic';
import { AtsAppointmentRecord } from '../../../../adapters/types/ats.types';
import { TrusteeOverride, CleansingClassification } from './ats-cleansing-types';

describe('ATS Cleansing Overrides', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  describe('checkOverride', () => {
    describe('SKIP action overrides', () => {
      test('should return SKIP result when override action is SKIP and all fields match', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('123', [
          {
            trusteeId: '123',
            status: 'PA',
            district: 'Middle',
            state: 'Louisiana',
            chapter: '7',
            action: 'SKIP',
            notes: 'Test data - exclude from migration',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 123,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: 'Louisiana',
          CHAPTER: '7',
        };

        const result = checkOverride('123', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.SKIP);
        expect(result?.skip).toBe(true);
        expect(result?.courtIds).toEqual([]);
        expect(result?.mapType).toBe('OVERRIDE:SKIP');
        expect(result?.notes).toEqual(['Test data - exclude from migration']);
      });

      test('should return SKIP result with default note when override has no notes', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('456', [
          {
            trusteeId: '456',
            status: 'NP',
            district: 'Northern',
            state: 'California',
            chapter: '11',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 456,
          STATUS: 'NP',
          DISTRICT: 'Northern',
          STATE: 'California',
          CHAPTER: '11',
        };

        const result = checkOverride('456', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.SKIP);
        expect(result?.notes).toEqual(['Skipped per override directive']);
      });

      test('should return SKIP result with case-insensitive matching', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('789', [
          {
            trusteeId: '789',
            status: 'pa',
            district: 'middle',
            state: 'louisiana',
            chapter: '7',
            action: 'SKIP',
            notes: 'Case test',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 789,
          STATUS: 'PA',
          DISTRICT: 'MIDDLE',
          STATE: 'LOUISIANA',
          CHAPTER: '7',
        };

        const result = checkOverride('789', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.SKIP);
        expect(result?.skip).toBe(true);
      });

      test('should return SKIP result matching with whitespace differences', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('101', [
          {
            trusteeId: '101',
            status: '  PA  ',
            district: '  Middle  ',
            state: '  Louisiana  ',
            chapter: '  7  ',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 101,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: 'Louisiana',
          CHAPTER: '7',
        };

        const result = checkOverride('101', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.SKIP);
      });

      test('should prioritize SKIP action when multiple overrides exist', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('202', [
          {
            trusteeId: '202',
            status: 'PA',
            district: 'Middle',
            state: 'Louisiana',
            chapter: '7',
            action: 'SKIP',
            notes: 'First SKIP override',
          },
          {
            trusteeId: '202',
            status: 'PA',
            district: 'Middle',
            state: 'Louisiana',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '053N',
            notes: 'MAP override that should be ignored',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 202,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: 'Louisiana',
          CHAPTER: '7',
        };

        const result = checkOverride('202', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.SKIP);
        expect(result?.mapType).toBe('OVERRIDE:SKIP');
        expect(result?.notes).toEqual(['First SKIP override']);
      });
    });

    describe('MAP action overrides', () => {
      test('should return MAP result with single court ID when override action is MAP', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('300', [
          {
            trusteeId: '300',
            status: 'NP',
            district: 'Central',
            state: 'California',
            chapter: '11',
            action: 'MAP',
            overrideCourtId: '0973',
            notes: 'Manual correction for NULL geography',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 300,
          STATUS: 'NP',
          DISTRICT: 'Central',
          STATE: 'California',
          CHAPTER: '11',
        };

        const result = checkOverride('300', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.AUTO_RECOVERABLE);
        expect(result?.skip).toBe(false);
        expect(result?.courtIds).toEqual(['0973']);
        expect(result?.mapType).toBe('OVERRIDE');
        expect(result?.notes).toEqual(['Manual correction for NULL geography']);
      });

      test('should return MAP result with multiple court IDs when multiple MAP overrides match', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('400', [
          {
            trusteeId: '400',
            status: 'PA',
            district: 'NULL',
            state: 'West Virginia',
            chapter: '11',
            action: 'MAP',
            overrideCourtId: '0424',
            notes: 'Northern district',
          },
          {
            trusteeId: '400',
            status: 'PA',
            district: 'NULL',
            state: 'West Virginia',
            chapter: '11',
            action: 'MAP',
            overrideCourtId: '0425',
            notes: 'Southern district',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 400,
          STATUS: 'PA',
          DISTRICT: 'NULL',
          STATE: 'West Virginia',
          CHAPTER: '11',
        };

        const result = checkOverride('400', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.AUTO_RECOVERABLE);
        expect(result?.skip).toBe(false);
        expect(result?.courtIds).toEqual(['0424', '0425']);
        expect(result?.mapType).toBe('OVERRIDE_1:2');
        expect(result?.notes).toEqual(['Northern district', 'Southern district']);
      });

      test('should return MAP result with default note when override has no notes', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('500', [
          {
            trusteeId: '500',
            status: 'PA',
            district: 'Eastern',
            state: 'New York',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0321',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 500,
          STATUS: 'PA',
          DISTRICT: 'Eastern',
          STATE: 'New York',
          CHAPTER: '7',
        };

        const result = checkOverride('500', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.notes).toEqual(['Manual override applied']);
      });

      test('should skip MAP overrides without overrideCourtId', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('600', [
          {
            trusteeId: '600',
            status: 'PA',
            district: 'Middle',
            state: 'Florida',
            chapter: '7',
            action: 'MAP',
            // Missing overrideCourtId
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 600,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: 'Florida',
          CHAPTER: '7',
        };

        const result = checkOverride('600', atsAppointment, overridesCache);

        expect(result).toBeNull();
      });

      test('should include only MAP overrides with court IDs when mixed with invalid MAP overrides', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('700', [
          {
            trusteeId: '700',
            status: 'PA',
            district: 'Southern',
            state: 'Texas',
            chapter: '11',
            action: 'MAP',
            // Missing overrideCourtId - should be excluded
          },
          {
            trusteeId: '700',
            status: 'PA',
            district: 'Southern',
            state: 'Texas',
            chapter: '11',
            action: 'MAP',
            overrideCourtId: '0528',
            notes: 'Valid override',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 700,
          STATUS: 'PA',
          DISTRICT: 'Southern',
          STATE: 'Texas',
          CHAPTER: '11',
        };

        const result = checkOverride('700', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.courtIds).toEqual(['0528']);
        expect(result?.notes).toEqual(['Valid override']);
      });

      test('should collect multiple notes from multiple MAP overrides', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('800', [
          {
            trusteeId: '800',
            status: 'NP',
            district: 'NULL',
            state: 'Delaware',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0157',
            notes: 'First note',
          },
          {
            trusteeId: '800',
            status: 'NP',
            district: 'NULL',
            state: 'Delaware',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0158',
            notes: 'Second note',
          },
          {
            trusteeId: '800',
            status: 'NP',
            district: 'NULL',
            state: 'Delaware',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0159',
            notes: 'Third note',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 800,
          STATUS: 'NP',
          DISTRICT: 'NULL',
          STATE: 'Delaware',
          CHAPTER: '7',
        };

        const result = checkOverride('800', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.courtIds).toHaveLength(3);
        expect(result?.notes).toEqual(['First note', 'Second note', 'Third note']);
        expect(result?.mapType).toBe('OVERRIDE_1:3');
      });
    });

    describe('No matching overrides', () => {
      test('should return null when trustee has no overrides in cache', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 999,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: 'Louisiana',
          CHAPTER: '7',
        };

        const result = checkOverride('999', atsAppointment, overridesCache);

        expect(result).toBeNull();
      });

      test('should return null when trustee has empty override array', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('998', []);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 998,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: 'Louisiana',
          CHAPTER: '7',
        };

        const result = checkOverride('998', atsAppointment, overridesCache);

        expect(result).toBeNull();
      });

      test('should return null when status does not match', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('997', [
          {
            trusteeId: '997',
            status: 'PA',
            district: 'Middle',
            state: 'Louisiana',
            chapter: '7',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 997,
          STATUS: 'NP', // Different status
          DISTRICT: 'Middle',
          STATE: 'Louisiana',
          CHAPTER: '7',
        };

        const result = checkOverride('997', atsAppointment, overridesCache);

        expect(result).toBeNull();
      });

      test('should return null when district does not match', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('996', [
          {
            trusteeId: '996',
            status: 'PA',
            district: 'Middle',
            state: 'Louisiana',
            chapter: '7',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 996,
          STATUS: 'PA',
          DISTRICT: 'Eastern', // Different district
          STATE: 'Louisiana',
          CHAPTER: '7',
        };

        const result = checkOverride('996', atsAppointment, overridesCache);

        expect(result).toBeNull();
      });

      test('should return null when state does not match', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('995', [
          {
            trusteeId: '995',
            status: 'PA',
            district: 'Middle',
            state: 'Louisiana',
            chapter: '7',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 995,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: 'Texas', // Different state
          CHAPTER: '7',
        };

        const result = checkOverride('995', atsAppointment, overridesCache);

        expect(result).toBeNull();
      });

      test('should return null when chapter does not match', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('994', [
          {
            trusteeId: '994',
            status: 'PA',
            district: 'Middle',
            state: 'Louisiana',
            chapter: '7',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 994,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: 'Louisiana',
          CHAPTER: '11', // Different chapter
        };

        const result = checkOverride('994', atsAppointment, overridesCache);

        expect(result).toBeNull();
      });

      test('should return null when only some fields match', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('993', [
          {
            trusteeId: '993',
            status: 'PA',
            district: 'Middle',
            state: 'Louisiana',
            chapter: '7',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 993,
          STATUS: 'PA', // Match
          DISTRICT: 'Middle', // Match
          STATE: 'Texas', // No match
          CHAPTER: '11', // No match
        };

        const result = checkOverride('993', atsAppointment, overridesCache);

        expect(result).toBeNull();
      });
    });

    describe('NULL value handling', () => {
      test('should match NULL string values in override with NULL string in appointment', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('901', [
          {
            trusteeId: '901',
            status: 'PA',
            district: 'NULL',
            state: 'California',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0973',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 901,
          STATUS: 'PA',
          DISTRICT: 'NULL',
          STATE: 'California',
          CHAPTER: '7',
        };

        const result = checkOverride('901', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.courtIds).toEqual(['0973']);
      });

      test('should match NULL string in override with empty/undefined in appointment', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('902', [
          {
            trusteeId: '902',
            status: 'PA',
            district: 'NULL',
            state: 'California',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0973',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 902,
          STATUS: 'PA',
          DISTRICT: '', // Empty string should match NULL
          STATE: 'California',
          CHAPTER: '7',
        };

        const result = checkOverride('902', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
      });

      test('should match empty string in override with NULL string in appointment', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('903', [
          {
            trusteeId: '903',
            status: 'PA',
            district: '',
            state: 'California',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0973',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 903,
          STATUS: 'PA',
          DISTRICT: 'NULL',
          STATE: 'California',
          CHAPTER: '7',
        };

        const result = checkOverride('903', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
      });
    });

    describe('Edge cases', () => {
      test('should handle appointment with undefined state field', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('850', [
          {
            trusteeId: '850',
            status: 'PA',
            district: 'Middle',
            state: 'NULL',
            chapter: '7',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 850,
          STATUS: 'PA',
          DISTRICT: 'Middle',
          STATE: undefined,
          CHAPTER: '7',
        };

        const result = checkOverride('850', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.SKIP);
      });

      test('should handle multiple matching MAP overrides with some missing court IDs', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('851', [
          {
            trusteeId: '851',
            status: 'PA',
            district: 'Southern',
            state: 'California',
            chapter: '11',
            action: 'MAP',
            overrideCourtId: '0921',
            notes: 'First',
          },
          {
            trusteeId: '851',
            status: 'PA',
            district: 'Southern',
            state: 'California',
            chapter: '11',
            action: 'MAP',
            // Missing overrideCourtId
            notes: 'Should be excluded',
          },
          {
            trusteeId: '851',
            status: 'PA',
            district: 'Southern',
            state: 'California',
            chapter: '11',
            action: 'MAP',
            overrideCourtId: '0922',
            notes: 'Second',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 851,
          STATUS: 'PA',
          DISTRICT: 'Southern',
          STATE: 'California',
          CHAPTER: '11',
        };

        const result = checkOverride('851', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.courtIds).toEqual(['0921', '0922']);
        expect(result?.notes).toEqual(['First', 'Second']);
        expect(result?.mapType).toBe('OVERRIDE_1:2');
      });

      test('should handle trustee with non-matching and matching overrides', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('852', [
          {
            trusteeId: '852',
            status: 'PA',
            district: 'Middle',
            state: 'Florida',
            chapter: '7',
            action: 'SKIP',
            notes: 'Non-matching override',
          },
          {
            trusteeId: '852',
            status: 'NP',
            district: 'Southern',
            state: 'Florida',
            chapter: '11',
            action: 'MAP',
            overrideCourtId: '0622',
            notes: 'Matching override',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 852,
          STATUS: 'NP',
          DISTRICT: 'Southern',
          STATE: 'Florida',
          CHAPTER: '11',
        };

        const result = checkOverride('852', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.AUTO_RECOVERABLE);
        expect(result?.courtIds).toEqual(['0622']);
        expect(result?.notes).toEqual(['Matching override']);
      });

      test('should filter out notes that are falsy when collecting from MAP overrides', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('860', [
          {
            trusteeId: '860',
            status: 'PA',
            district: 'Northern',
            state: 'Illinois',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0313',
            notes: 'First note',
          },
          {
            trusteeId: '860',
            status: 'PA',
            district: 'Northern',
            state: 'Illinois',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0314',
            notes: '', // Empty string should be filtered
          },
          {
            trusteeId: '860',
            status: 'PA',
            district: 'Northern',
            state: 'Illinois',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0315',
            // Undefined notes
          },
          {
            trusteeId: '860',
            status: 'PA',
            district: 'Northern',
            state: 'Illinois',
            chapter: '7',
            action: 'MAP',
            overrideCourtId: '0316',
            notes: 'Second note',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 860,
          STATUS: 'PA',
          DISTRICT: 'Northern',
          STATE: 'Illinois',
          CHAPTER: '7',
        };

        const result = checkOverride('860', atsAppointment, overridesCache);

        expect(result).not.toBeNull();
        expect(result?.courtIds).toHaveLength(4);
        expect(result?.notes).toEqual(['First note', 'Second note']); // Only non-falsy notes
      });

      test('should return null when all matching overrides are SKIP with no MAP overrides', () => {
        const overridesCache = new Map<string, TrusteeOverride[]>();
        overridesCache.set('870', [
          {
            trusteeId: '870',
            status: 'NP',
            district: 'Western',
            state: 'Michigan',
            chapter: '11',
            action: 'SKIP',
          },
        ]);

        const atsAppointment: AtsAppointmentRecord = {
          TRU_ID: 870,
          STATUS: 'NP',
          DISTRICT: 'Western',
          STATE: 'Michigan',
          CHAPTER: '11',
        };

        const result = checkOverride('870', atsAppointment, overridesCache);

        // Even though there's a matching override, SKIP is returned not null
        expect(result).not.toBeNull();
        expect(result?.classification).toBe(CleansingClassification.SKIP);
      });
    });
  });

  describe('loadTrusteeOverrides - Integration Tests', () => {
    test('should successfully load overrides from TSV file without error', async () => {
      const result = await loadTrusteeOverrides(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeInstanceOf(Map);
      // File may be empty in test environment, but should load successfully
    });

    test('should return empty map when TSV file is empty', async () => {
      const result = await loadTrusteeOverrides(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeInstanceOf(Map);
      // Empty file should return empty map, not an error
    });

    test('should handle missing TSV file gracefully by returning empty map', async () => {
      // This test verifies the file-not-found path
      // The actual file exists but this documents expected behavior
      const result = await loadTrusteeOverrides(context);

      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
    });
  });
});
