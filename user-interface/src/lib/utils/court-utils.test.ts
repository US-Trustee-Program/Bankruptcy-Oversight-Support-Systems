import { describe, test, expect } from 'vitest';
import {
  getStateNameFromCode,
  sortByCourtLocation,
  getUniqueDistricts,
  getDivisionsForDistrict,
  buildDivisionsDisplay,
  getUserDivisionCodes,
  resolveCombinedSelections,
  encodeDivisionCodes,
} from './court-utils';
import { CourtDivisionDetails } from '@common/cams/courts';
import { CamsSession } from '@common/cams/session';
import MockData from '@common/cams/test-utilities/mock-data';

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

  describe('getUniqueDistricts', () => {
    test('should deduplicate districts by courtId', () => {
      const courts: CourtDivisionDetails[] = [
        {
          officeName: 'Juneau',
          officeCode: '097-J',
          courtId: '097',
          courtName: 'District of Alaska',
          courtDivisionCode: '710',
          courtDivisionName: 'Juneau',
          groupDesignator: 'AK',
          regionId: '18',
          regionName: 'Region 18',
          state: 'AK',
        },
        {
          officeName: 'Nome',
          officeCode: '097-N',
          courtId: '097',
          courtName: 'District of Alaska',
          courtDivisionCode: '711',
          courtDivisionName: 'Nome',
          groupDesignator: 'AK',
          regionId: '18',
          regionName: 'Region 18',
          state: 'AK',
        },
      ];

      const districts = getUniqueDistricts(courts);

      expect(districts).toHaveLength(1);
      expect(districts[0]).toEqual({
        courtId: '097',
        courtName: 'District of Alaska',
        state: 'AK',
      });
    });

    test('should sort districts by state name then court name', () => {
      const courts: CourtDivisionDetails[] = [
        {
          officeName: 'Manhattan',
          officeCode: '081-M',
          courtId: '081',
          courtName: 'Southern District of New York',
          courtDivisionCode: '501',
          courtDivisionName: 'Manhattan',
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'Region 2',
          state: 'NY',
        },
        {
          officeName: 'Los Angeles',
          officeCode: '052-LA',
          courtId: '052',
          courtName: 'Central District of California',
          courtDivisionCode: '201',
          courtDivisionName: 'Los Angeles',
          groupDesignator: 'CA',
          regionId: '15',
          regionName: 'Region 15',
          state: 'CA',
        },
        {
          officeName: 'San Francisco',
          officeCode: '053-SF',
          courtId: '053',
          courtName: 'Northern District of California',
          courtDivisionCode: '301',
          courtDivisionName: 'San Francisco',
          groupDesignator: 'CA',
          regionId: '15',
          regionName: 'Region 15',
          state: 'CA',
        },
      ];

      const districts = getUniqueDistricts(courts);

      expect(districts).toHaveLength(3);
      // California < New York alphabetically
      expect(districts[0].state).toBe('CA');
      expect(districts[0].courtName).toBe('Central District of California');
      expect(districts[1].state).toBe('CA');
      expect(districts[1].courtName).toBe('Northern District of California');
      expect(districts[2].state).toBe('NY');
      expect(districts[2].courtName).toBe('Southern District of New York');
    });

    test('should handle empty array', () => {
      const districts = getUniqueDistricts([]);
      expect(districts).toEqual([]);
    });

    test('should handle missing state field', () => {
      const courts: CourtDivisionDetails[] = [
        {
          officeName: 'Test Office',
          officeCode: '999-T',
          courtId: '999',
          courtName: 'Test District',
          courtDivisionCode: '001',
          courtDivisionName: 'Test Division',
          groupDesignator: 'XX',
          regionId: '99',
          regionName: 'Region 99',
        },
      ];

      const districts = getUniqueDistricts(courts);

      expect(districts).toHaveLength(1);
      expect(districts[0]).toEqual({
        courtId: '999',
        courtName: 'Test District',
        state: undefined,
      });
    });
  });

  describe('getDivisionsForDistrict', () => {
    const courts: CourtDivisionDetails[] = [
      {
        officeName: 'Juneau',
        officeCode: '097-J',
        courtId: '097',
        courtName: 'District of Alaska',
        courtDivisionCode: '710',
        courtDivisionName: 'Juneau',
        groupDesignator: 'AK',
        regionId: '18',
        regionName: 'Region 18',
        state: 'AK',
      },
      {
        officeName: 'Nome',
        officeCode: '097-N',
        courtId: '097',
        courtName: 'District of Alaska',
        courtDivisionCode: '711',
        courtDivisionName: 'Nome',
        groupDesignator: 'AK',
        regionId: '18',
        regionName: 'Region 18',
        state: 'AK',
      },
      {
        officeName: 'Anchorage',
        officeCode: '097-A',
        courtId: '097',
        courtName: 'District of Alaska',
        courtDivisionCode: '709',
        courtDivisionName: 'Anchorage',
        groupDesignator: 'AK',
        regionId: '18',
        regionName: 'Region 18',
        state: 'AK',
      },
      {
        officeName: 'Manhattan',
        officeCode: '081-M',
        courtId: '081',
        courtName: 'Southern District of New York',
        courtDivisionCode: '501',
        courtDivisionName: 'Manhattan',
        groupDesignator: 'NY',
        regionId: '02',
        regionName: 'Region 2',
        state: 'NY',
      },
    ];

    test('should return divisions for a given courtId', () => {
      const divisions = getDivisionsForDistrict(courts, '097');

      expect(divisions).toHaveLength(3);
      expect(divisions.map((d) => d.courtDivisionCode)).toContain('710');
      expect(divisions.map((d) => d.courtDivisionCode)).toContain('711');
      expect(divisions.map((d) => d.courtDivisionCode)).toContain('709');
    });

    test('should sort divisions alphabetically by division name', () => {
      const divisions = getDivisionsForDistrict(courts, '097');

      // Anchorage < Juneau < Nome alphabetically
      expect(divisions[0].courtDivisionName).toBe('Anchorage');
      expect(divisions[1].courtDivisionName).toBe('Juneau');
      expect(divisions[2].courtDivisionName).toBe('Nome');
    });

    test('should return empty array for non-existent courtId', () => {
      const divisions = getDivisionsForDistrict(courts, '999');
      expect(divisions).toEqual([]);
    });

    test('should return empty array for empty input', () => {
      const divisions = getDivisionsForDistrict([], '097');
      expect(divisions).toEqual([]);
    });

    test('should handle district with single division', () => {
      const divisions = getDivisionsForDistrict(courts, '081');

      expect(divisions).toHaveLength(1);
      expect(divisions[0]).toEqual({
        courtDivisionCode: '501',
        courtDivisionName: 'Manhattan',
      });
    });
  });

  describe('buildDivisionsDisplay', () => {
    const alaskaCourts: CourtDivisionDetails[] = [
      {
        officeName: 'Anchorage',
        officeCode: '097-A',
        courtId: '097',
        courtName: 'District of Alaska',
        courtDivisionCode: '709',
        courtDivisionName: 'Anchorage',
        groupDesignator: 'AK',
        regionId: '18',
        regionName: 'Region 18',
        state: 'AK',
      },
      {
        officeName: 'Juneau',
        officeCode: '097-J',
        courtId: '097',
        courtName: 'District of Alaska',
        courtDivisionCode: '710',
        courtDivisionName: 'Juneau',
        groupDesignator: 'AK',
        regionId: '18',
        regionName: 'Region 18',
        state: 'AK',
      },
      {
        officeName: 'Nome',
        officeCode: '097-N',
        courtId: '097',
        courtName: 'District of Alaska',
        courtDivisionCode: '711',
        courtDivisionName: 'Nome',
        groupDesignator: 'AK',
        regionId: '18',
        regionName: 'Region 18',
        state: 'AK',
      },
    ];

    test('should return "All" when all divisions for a district are selected', () => {
      const result = buildDivisionsDisplay(
        { courtId: '097', divisionCodes: ['709', '710', '711'] },
        alaskaCourts,
      );
      expect(result).toBe('All');
    });

    test('should return sorted comma-separated names for partial division selection', () => {
      const result = buildDivisionsDisplay(
        { courtId: '097', divisionCodes: ['711', '709'] },
        alaskaCourts,
      );
      expect(result).toBe('Anchorage, Nome');
    });

    test('should return single division name when one division code is selected', () => {
      const result = buildDivisionsDisplay(
        { courtId: '097', divisionCodes: ['710'] },
        alaskaCourts,
      );
      expect(result).toBe('Juneau');
    });

    test('should fall back to raw codes when courts data is empty', () => {
      const result = buildDivisionsDisplay({ courtId: '097', divisionCodes: ['710', '711'] }, []);
      expect(result).toBe('710, 711');
    });

    test('should fall back to raw codes when courtId is missing', () => {
      const result = buildDivisionsDisplay({ divisionCodes: ['710'] }, alaskaCourts);
      expect(result).toBe('710');
    });

    test('should use courtDivisionName when provided (legacy enriched)', () => {
      const result = buildDivisionsDisplay({ courtDivisionName: 'Juneau' }, alaskaCourts);
      expect(result).toBe('Juneau');
    });

    test('should look up name from divisionCode when courts data is available', () => {
      const result = buildDivisionsDisplay({ courtId: '097', divisionCode: '711' }, alaskaCourts);
      expect(result).toBe('Nome');
    });

    test('should fall back to raw divisionCode when courts data is empty', () => {
      const result = buildDivisionsDisplay({ courtId: '097', divisionCode: '711' }, []);
      expect(result).toBe('711');
    });

    test('should fall back to raw divisionCode when courtId is missing', () => {
      const result = buildDivisionsDisplay({ divisionCode: '711' }, alaskaCourts);
      expect(result).toBe('711');
    });

    test('should return "Not specified" when no division data exists', () => {
      const result = buildDivisionsDisplay({}, alaskaCourts);
      expect(result).toBe('Not specified');
    });

    test('should return "Not specified" when divisionCodes is empty array', () => {
      const result = buildDivisionsDisplay({ courtId: '097', divisionCodes: [] }, alaskaCourts);
      expect(result).toBe('Not specified');
    });

    test('should fall back to code when division code is not found in courts data', () => {
      const result = buildDivisionsDisplay(
        { courtId: '097', divisionCodes: ['999'] },
        alaskaCourts,
      );
      expect(result).toBe('999');
    });

    test('should prefer divisionCodes over legacy divisionCode when both present', () => {
      const result = buildDivisionsDisplay(
        { courtId: '097', divisionCodes: ['710', '711'], divisionCode: '709' },
        alaskaCourts,
      );
      expect(result).toBe('Juneau, Nome');
    });
  });

  describe('getUserDivisionCodes', () => {
    test('returns empty set when session is null', () => {
      expect(getUserDivisionCodes(null).size).toBe(0);
    });

    test('returns empty set when session has no offices', () => {
      const session = {
        ...MockData.getCamsSession(),
        user: { ...MockData.getCamsSession().user, offices: [] },
      };
      expect(getUserDivisionCodes(session).size).toBe(0);
    });

    test('collects division codes from all offices and groups', () => {
      const session: CamsSession = {
        ...MockData.getCamsSession(),
        user: {
          ...MockData.getCamsSession().user,
          offices: [
            {
              officeCode: '081',
              officeName: 'Manhattan',
              idpGroupName: 'Manhattan',
              regionId: '02',
              regionName: 'New York',
              groups: [
                {
                  groupDesignator: 'NY',
                  divisions: [
                    {
                      divisionCode: '081',
                      court: { courtId: 'NYSB', courtName: 'SDNY' },
                      courtOffice: { courtOfficeCode: '081', courtOfficeName: 'Manhattan' },
                    },
                    {
                      divisionCode: '087',
                      court: { courtId: 'NYSB', courtName: 'SDNY' },
                      courtOffice: { courtOfficeCode: '087', courtOfficeName: 'White Plains' },
                    },
                  ],
                },
              ],
            },
            {
              officeCode: '088',
              officeName: 'Rutland',
              idpGroupName: 'Rutland',
              regionId: '01',
              regionName: 'Boston',
              groups: [
                {
                  groupDesignator: 'VT',
                  divisions: [
                    {
                      divisionCode: '088',
                      court: { courtId: 'VTB', courtName: 'Vermont' },
                      courtOffice: { courtOfficeCode: '088', courtOfficeName: 'Rutland' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      };
      const codes = getUserDivisionCodes(session);
      expect(codes).toEqual(new Set(['081', '087', '088']));
    });
  });

  describe('resolveCombinedSelections', () => {
    test('returns empty array when next is empty', () => {
      const previous = [{ value: 'NYSB|081', label: 'Manhattan' }];
      expect(resolveCombinedSelections(previous, [])).toEqual([]);
    });

    test('returns next unchanged when no new options were added', () => {
      const selections = [{ value: 'NYSB|081', label: 'Manhattan' }];
      expect(resolveCombinedSelections(selections, selections)).toEqual(selections);
    });

    test('selecting ALL removes specific divisions for that court', () => {
      const previous = [{ value: 'NYSB|081', label: 'Manhattan' }];
      const next = [
        { value: 'NYSB|081', label: 'Manhattan' },
        { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
      ];
      expect(resolveCombinedSelections(previous, next)).toEqual([
        { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
      ]);
    });

    test('selecting a specific division removes ALL for that court', () => {
      const previous = [{ value: 'NYSB|ALL', label: 'Southern District of New York (All)' }];
      const next = [
        { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
        { value: 'NYSB|081', label: 'Manhattan' },
      ];
      expect(resolveCombinedSelections(previous, next)).toEqual([
        { value: 'NYSB|081', label: 'Manhattan' },
      ]);
    });

    test('mutual exclusion only applies within the same court', () => {
      const previous = [{ value: 'VTB|088', label: 'Rutland' }];
      const next = [
        { value: 'VTB|088', label: 'Rutland' },
        { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
      ];
      const result = resolveCombinedSelections(previous, next);
      expect(result).toContainEqual({ value: 'VTB|088', label: 'Rutland' });
      expect(result).toContainEqual({
        value: 'NYSB|ALL',
        label: 'Southern District of New York (All)',
      });
    });
  });

  describe('encodeDivisionCodes', () => {
    const courts: CourtDivisionDetails[] = [
      {
        courtId: 'NYSB',
        courtName: 'Southern District of New York',
        courtDivisionCode: '081',
        courtDivisionName: 'Manhattan',
        officeName: 'Manhattan',
        officeCode: '081',
        groupDesignator: 'NY',
        regionId: '02',
        regionName: 'Region 2',
      },
      {
        courtId: 'NYSB',
        courtName: 'Southern District of New York',
        courtDivisionCode: '087',
        courtDivisionName: 'White Plains',
        officeName: 'White Plains',
        officeCode: '087',
        groupDesignator: 'NY',
        regionId: '02',
        regionName: 'Region 2',
      },
      {
        courtId: 'VTB',
        courtName: 'District of Vermont',
        courtDivisionCode: '088',
        courtDivisionName: 'Rutland',
        officeName: 'Rutland',
        officeCode: '088',
        groupDesignator: 'VT',
        regionId: '01',
        regionName: 'Region 1',
      },
    ];

    test('returns undefined when no divisions selected', () => {
      expect(encodeDivisionCodes([], courts)).toBeUndefined();
    });

    test('returns specific division code', () => {
      const selections = [{ value: 'NYSB|081', label: 'Manhattan' }];
      expect(encodeDivisionCodes(selections, courts)).toEqual(['081']);
    });

    test('expands ALL to all division codes for that court', () => {
      const selections = [{ value: 'NYSB|ALL', label: 'Southern District of New York (All)' }];
      expect(encodeDivisionCodes(selections, courts)).toEqual(
        expect.arrayContaining(['081', '087']),
      );
    });

    test('deduplicates when ALL and specific division selected for same court', () => {
      const selections = [
        { value: 'NYSB|ALL', label: 'Southern District of New York (All)' },
        { value: 'NYSB|081', label: 'Manhattan' },
      ];
      const result = encodeDivisionCodes(selections, courts)!;
      expect(result).toEqual(expect.arrayContaining(['081', '087']));
      expect(result.length).toBe(new Set(result).size);
    });

    test('handles mixed courts', () => {
      const selections = [
        { value: 'NYSB|081', label: 'Manhattan' },
        { value: 'VTB|088', label: 'Rutland' },
      ];
      expect(encodeDivisionCodes(selections, courts)).toEqual(
        expect.arrayContaining(['081', '088']),
      );
    });
  });
});
