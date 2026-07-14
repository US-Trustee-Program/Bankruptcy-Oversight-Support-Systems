import { describe, test, expect } from 'vitest';
import { CourtDivisionDetails } from '@common/cams/courts';
import { extractCourtAndDivisions } from './TrusteeAppointmentForm';
import { ALL_DIVISIONS_VALUE } from './useDivisionSelection';

describe('TrusteeAppointmentForm Helper Functions', () => {
  const mockCourts: CourtDivisionDetails[] = [
    {
      courtId: '081-',
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
      courtId: '081-',
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
      courtId: '081-',
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

  describe('extractCourtAndDivisions', () => {
    describe('when useSeparateFields is true (new format)', () => {
      test('should return null when courtId is missing', () => {
        const result = extractCourtAndDivisions(
          {
            courtId: '',
            divisionCodes: ['301'],
            districtKey: '',
          },
          true,
          mockCourts,
        );

        expect(result).toBeNull();
      });

      test('should return null when divisionCodes is empty', () => {
        const result = extractCourtAndDivisions(
          {
            courtId: '081-',
            divisionCodes: [],
            districtKey: '',
          },
          true,
          mockCourts,
        );

        expect(result).toBeNull();
      });

      test('should return courtId and specific divisions when single division selected', () => {
        const result = extractCourtAndDivisions(
          {
            courtId: '081-',
            divisionCodes: ['301'],
            districtKey: '',
          },
          true,
          mockCourts,
        );

        expect(result).toEqual({
          courtId: '081-',
          divisionCodes: ['301'],
        });
      });

      test('should return courtId and multiple divisions when multiple divisions selected', () => {
        const result = extractCourtAndDivisions(
          {
            courtId: '081-',
            divisionCodes: ['301', '303'],
            districtKey: '',
          },
          true,
          mockCourts,
        );

        expect(result).toEqual({
          courtId: '081-',
          divisionCodes: ['301', '303'],
        });
      });

      test('should expand "All Divisions" to actual division codes', () => {
        const result = extractCourtAndDivisions(
          {
            courtId: '081-',
            divisionCodes: [ALL_DIVISIONS_VALUE],
            districtKey: '',
          },
          true,
          mockCourts,
        );

        expect(result).toEqual({
          courtId: '081-',
          divisionCodes: expect.arrayContaining(['301', '303', '310']),
        });
        expect(result!.divisionCodes).toHaveLength(3);
      });

      test('should expand "All Divisions" for correct district only', () => {
        const multiDistrictCourts: CourtDivisionDetails[] = [
          ...mockCourts,
          {
            courtId: '097-',
            courtName: 'District of Alaska',
            courtDivisionCode: '710',
            courtDivisionName: 'Juneau',
            regionId: '09',
            regionName: 'Region 09',
            officeCode: 'AK',
            officeName: 'Alaska',
            groupDesignator: 'EO',
            state: 'AK',
          },
        ];

        const result = extractCourtAndDivisions(
          {
            courtId: '081-',
            divisionCodes: [ALL_DIVISIONS_VALUE],
            districtKey: '',
          },
          true,
          multiDistrictCourts,
        );

        // Should only expand to Missouri divisions, not Alaska
        expect(result).toEqual({
          courtId: '081-',
          divisionCodes: expect.arrayContaining(['301', '303', '310']),
        });
        expect(result!.divisionCodes).toHaveLength(3);
        expect(result!.divisionCodes).not.toContain('710');
      });
    });

    describe('when useSeparateFields is false (legacy format)', () => {
      test('should return null when districtKey is missing', () => {
        const result = extractCourtAndDivisions(
          {
            courtId: '',
            divisionCodes: [],
            districtKey: '',
          },
          false,
          mockCourts,
        );

        expect(result).toBeNull();
      });

      test('should parse districtKey and return courtId and single divisionCode', () => {
        const result = extractCourtAndDivisions(
          {
            courtId: '',
            divisionCodes: [],
            districtKey: '081-|301',
          },
          false,
          mockCourts,
        );

        expect(result).toEqual({
          courtId: '081-',
          divisionCodes: ['301'],
        });
      });
    });
  });
});
