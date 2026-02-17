import { describe, test, expect } from 'vitest';
import { getStateNameFromCode, sortByCourtLocation } from './court-utils';

describe('court-utils', () => {
  describe('getStateNameFromCode', () => {
    test('should map common state codes to full names', () => {
      expect(getStateNameFromCode('NY')).toBe('New York');
      expect(getStateNameFromCode('CA')).toBe('California');
      expect(getStateNameFromCode('TX')).toBe('Texas');
      expect(getStateNameFromCode('FL')).toBe('Florida');
    });

    test('should handle District of Columbia correctly', () => {
      expect(getStateNameFromCode('DC')).toBe('District of Columbia');
    });

    test('should handle US territories', () => {
      expect(getStateNameFromCode('PR')).toBe('Puerto Rico');
      expect(getStateNameFromCode('GU')).toBe('Guam');
      expect(getStateNameFromCode('VI')).toBe('Virgin Islands');
    });

    test('should return original code if not found in mapping', () => {
      expect(getStateNameFromCode('XX')).toBe('XX');
      expect(getStateNameFromCode('ZZ')).toBe('ZZ');
    });

    test('should handle empty string', () => {
      expect(getStateNameFromCode('')).toBe('');
    });
  });

  describe('sortByCourtLocation', () => {
    describe('sorting by state name', () => {
      test('should sort by full state name, not abbreviation', () => {
        const items = [
          { state: 'NY', courtName: 'District of New York', courtDivisionName: 'Manhattan' },
          { state: 'CA', courtName: 'District of California', courtDivisionName: 'Los Angeles' },
          { state: 'TX', courtName: 'District of Texas', courtDivisionName: 'Houston' },
        ];

        const sorted = sortByCourtLocation(items);

        // California < New York < Texas (alphabetically by full name)
        expect(sorted.map((i) => i.state)).toEqual(['CA', 'NY', 'TX']);
      });

      test('should correctly sort Nevada before New York (NV vs NY by full name)', () => {
        // This test verifies the bug fix: sorting by code would put NY before NV
        // but sorting by full name puts Nevada before New York
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
          { state: 'NV', courtName: 'District of Nevada', courtDivisionName: 'Las Vegas' },
        ];

        const sorted = sortByCourtLocation(items);

        // Nevada < New York (alphabetically)
        expect(sorted.map((i) => i.state)).toEqual(['NV', 'NY']);
      });

      test('should sort Alaska before Washington', () => {
        const items = [
          {
            state: 'WA',
            courtName: 'Western District of Washington',
            courtDivisionName: 'Seattle',
          },
          { state: 'AK', courtName: 'District of Alaska', courtDivisionName: 'Anchorage' },
        ];

        const sorted = sortByCourtLocation(items);

        expect(sorted.map((i) => i.state)).toEqual(['AK', 'WA']);
      });
    });

    describe('sorting by court name within state', () => {
      test('should sort by court name within the same state', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
          { state: 'NY', courtName: 'Eastern District of New York', courtDivisionName: 'Brooklyn' },
          { state: 'NY', courtName: 'Northern District of New York', courtDivisionName: 'Albany' },
        ];

        const sorted = sortByCourtLocation(items);

        expect(sorted.map((i) => i.courtName)).toEqual([
          'Eastern District of New York',
          'Northern District of New York',
          'Southern District of New York',
        ]);
      });
    });

    describe('sorting by division name within court', () => {
      test('should sort by division name within the same court', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'White Plains',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
          { state: 'NY', courtName: 'Southern District of New York', courtDivisionName: 'Albany' },
        ];

        const sorted = sortByCourtLocation(items);

        expect(sorted.map((i) => i.courtDivisionName)).toEqual([
          'Albany',
          'Manhattan',
          'White Plains',
        ]);
      });
    });

    describe('combined sorting', () => {
      test('should apply all sorting rules: state → court → division', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
          {
            state: 'CA',
            courtName: 'Central District of California',
            courtDivisionName: 'Los Angeles',
          },
          { state: 'NY', courtName: 'Eastern District of New York', courtDivisionName: 'Brooklyn' },
          {
            state: 'CA',
            courtName: 'Northern District of California',
            courtDivisionName: 'San Francisco',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'White Plains',
          },
        ];

        const sorted = sortByCourtLocation(items);

        expect(sorted).toEqual([
          {
            state: 'CA',
            courtName: 'Central District of California',
            courtDivisionName: 'Los Angeles',
          },
          {
            state: 'CA',
            courtName: 'Northern District of California',
            courtDivisionName: 'San Francisco',
          },
          { state: 'NY', courtName: 'Eastern District of New York', courtDivisionName: 'Brooklyn' },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'White Plains',
          },
        ]);
      });
    });

    describe('appointment details sorting', () => {
      test('should sort by chapter number when includeAppointmentDetails is true', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '13',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '7',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '11',
          },
        ];

        const sorted = sortByCourtLocation(items, { includeAppointmentDetails: true });

        expect(sorted.map((i) => i.chapter)).toEqual(['7', '11', '13']);
      });

      test('should handle chapter with subchapter suffix (11-subchapter-v)', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '13',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '11-subchapter-v',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '7',
          },
        ];

        const sorted = sortByCourtLocation(items, { includeAppointmentDetails: true });

        // 11-subchapter-v should sort as 11
        expect(sorted.map((i) => i.chapter)).toEqual(['7', '11-subchapter-v', '13']);
      });

      test('should sort by appointment type alphabetically after chapter', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '7',
            appointmentType: 'panel',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '7',
            appointmentType: 'elected',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '7',
            appointmentType: 'off-panel',
          },
        ];

        const sorted = sortByCourtLocation(items, { includeAppointmentDetails: true });

        expect(sorted.map((i) => i.appointmentType)).toEqual(['elected', 'off-panel', 'panel']);
      });

      test('should not sort by chapter/appointmentType when includeAppointmentDetails is false', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '13',
            appointmentType: 'panel',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
            chapter: '7',
            appointmentType: 'elected',
          },
        ];

        const sorted = sortByCourtLocation(items);

        // Without includeAppointmentDetails, items with same state/court/division should maintain relative order
        // (though in practice they're equal, so order is stable)
        expect(sorted.map((i) => i.chapter)).toEqual(['13', '7']);
      });
    });

    describe('edge cases', () => {
      test('should handle empty array', () => {
        const sorted = sortByCourtLocation([]);
        expect(sorted).toEqual([]);
      });

      test('should handle single item', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
        ];
        const sorted = sortByCourtLocation(items);
        expect(sorted).toEqual(items);
      });

      test('should handle missing state field gracefully', () => {
        const items = [
          { courtName: 'Southern District of New York', courtDivisionName: 'Manhattan' },
          { state: 'CA', courtName: 'District of California', courtDivisionName: 'Los Angeles' },
        ];

        const sorted = sortByCourtLocation(items);

        // Items with state come after empty state (empty string sorts first)
        expect(sorted[0].state).toBeUndefined();
        expect(sorted[1].state).toBe('CA');
      });

      test('should handle missing courtName field', () => {
        const items = [
          { state: 'NY', courtDivisionName: 'Manhattan' },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Brooklyn',
          },
        ];

        const sorted = sortByCourtLocation(items);

        // Empty courtName sorts first within same state
        expect(sorted[0].courtName).toBeUndefined();
        expect(sorted[1].courtName).toBe('Southern District of New York');
      });

      test('should handle missing courtDivisionName field', () => {
        const items = [
          { state: 'NY', courtName: 'Southern District of New York' },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
        ];

        const sorted = sortByCourtLocation(items);

        // Empty division sorts first within same court
        expect(sorted[0].courtDivisionName).toBeUndefined();
        expect(sorted[1].courtDivisionName).toBe('Manhattan');
      });

      test('should not mutate the original array', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
          { state: 'CA', courtName: 'District of California', courtDivisionName: 'Los Angeles' },
        ];

        const originalOrder = [...items];
        sortByCourtLocation(items);

        expect(items).toEqual(originalOrder);
      });

      test('should return equal comparison (0) for identical items', () => {
        const items = [
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
          {
            state: 'NY',
            courtName: 'Southern District of New York',
            courtDivisionName: 'Manhattan',
          },
        ];

        const sorted = sortByCourtLocation(items);

        // Both items should be present
        expect(sorted).toHaveLength(2);
        expect(sorted[0]).toEqual(sorted[1]);
      });
    });
  });
});
