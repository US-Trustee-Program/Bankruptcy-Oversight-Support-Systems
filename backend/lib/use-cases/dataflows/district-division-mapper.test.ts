import { describe, test, expect } from 'vitest';
import { buildDistrictToDivisionsMap, DivisionInfo } from './district-division-mapper';
import { UstpOfficeDetails } from '@common/cams/offices';

describe('district-division-mapper', () => {
  const mockOffices: UstpOfficeDetails[] = [
    {
      officeCode: 'USTP_REGION_02_MANHATTAN',
      officeName: 'Manhattan',
      idpGroupName: 'USTP REGION 02 MANHATTAN',
      regionId: '2',
      regionName: 'New York',
      groups: [
        {
          groupDesignator: 'MN',
          divisions: [
            {
              divisionCode: 'MAH',
              court: {
                courtId: '081',
                courtName: 'United States Bankruptcy Court for the Southern District of New York',
                state: 'NY',
              },
              courtOffice: {
                courtOfficeCode: 'MAH',
                courtOfficeName: 'Manhattan Office',
              },
            },
            {
              divisionCode: 'MAN',
              court: {
                courtId: '081',
                courtName: 'United States Bankruptcy Court for the Southern District of New York',
                state: 'NY',
              },
              courtOffice: {
                courtOfficeCode: 'MAN',
                courtOfficeName: 'Poughkeepsie Office',
              },
            },
            {
              divisionCode: 'MAW',
              court: {
                courtId: '081',
                courtName: 'United States Bankruptcy Court for the Southern District of New York',
                state: 'NY',
              },
              courtOffice: {
                courtOfficeCode: 'MAW',
                courtOfficeName: 'White Plains Office',
              },
            },
          ],
        },
      ],
    },
    {
      officeCode: 'USTP_REGION_03_PHILADELPHIA',
      officeName: 'Philadelphia',
      idpGroupName: 'USTP REGION 03 PHILADELPHIA',
      regionId: '3',
      regionName: 'Pennsylvania',
      groups: [
        {
          groupDesignator: 'PH',
          divisions: [
            {
              divisionCode: 'PAE',
              court: {
                courtId: '231',
                courtName:
                  'United States Bankruptcy Court for the Eastern District of Pennsylvania',
                state: 'PA',
              },
              courtOffice: {
                courtOfficeCode: 'PAE',
                courtOfficeName: 'Philadelphia Office',
              },
            },
          ],
        },
      ],
    },
  ];

  describe('buildDistrictToDivisionsMap', () => {
    test('should map district 081 to all its divisions', () => {
      const districtMap = buildDistrictToDivisionsMap(mockOffices);

      const divisions = districtMap.get('081');
      expect(divisions).toBeDefined();
      expect(divisions).toHaveLength(3);

      const divisionCodes = divisions!.map((d) => d.divisionCode);
      expect(divisionCodes).toContain('MAH');
      expect(divisionCodes).toContain('MAN');
      expect(divisionCodes).toContain('MAW');
    });

    test('should include court information for each division', () => {
      const districtMap = buildDistrictToDivisionsMap(mockOffices);

      const divisions = districtMap.get('081');
      const mahDivision = divisions!.find((d) => d.divisionCode === 'MAH');

      expect(mahDivision).toBeDefined();
      expect(mahDivision!.courtId).toBe('081');
      expect(mahDivision!.courtName).toBe(
        'United States Bankruptcy Court for the Southern District of New York',
      );
      expect(mahDivision!.courtDivisionName).toBe('Manhattan Office');
    });

    test('should map district 231 to its single division', () => {
      const districtMap = buildDistrictToDivisionsMap(mockOffices);

      const divisions = districtMap.get('231');
      expect(divisions).toBeDefined();
      expect(divisions).toHaveLength(1);
      expect(divisions![0].divisionCode).toBe('PAE');
      expect(divisions![0].courtId).toBe('231');
    });

    test('should return empty map for empty offices array', () => {
      const districtMap = buildDistrictToDivisionsMap([]);

      expect(districtMap.size).toBe(0);
    });

    test('should handle district with no divisions gracefully', () => {
      const emptyOffice: UstpOfficeDetails = {
        officeCode: 'USTP_REGION_99_EMPTY',
        officeName: 'Empty',
        idpGroupName: 'USTP REGION 99 EMPTY',
        regionId: '99',
        regionName: 'Empty Region',
        groups: [],
      };

      const districtMap = buildDistrictToDivisionsMap([emptyOffice]);

      expect(districtMap.size).toBe(0);
    });

    test('should consolidate divisions from multiple groups under same district', () => {
      const multiGroupOffice: UstpOfficeDetails = {
        officeCode: 'USTP_REGION_99_MULTI',
        officeName: 'Multi-Group',
        idpGroupName: 'USTP REGION 99 MULTI',
        regionId: '99',
        regionName: 'Multi Region',
        groups: [
          {
            groupDesignator: 'MG1',
            divisions: [
              {
                divisionCode: 'DIV1',
                court: {
                  courtId: '999',
                  courtName: 'Test Court',
                  state: 'XX',
                },
                courtOffice: {
                  courtOfficeCode: 'DIV1',
                  courtOfficeName: 'Division 1',
                },
              },
            ],
          },
          {
            groupDesignator: 'MG2',
            divisions: [
              {
                divisionCode: 'DIV2',
                court: {
                  courtId: '999',
                  courtName: 'Test Court',
                  state: 'XX',
                },
                courtOffice: {
                  courtOfficeCode: 'DIV2',
                  courtOfficeName: 'Division 2',
                },
              },
            ],
          },
        ],
      };

      const districtMap = buildDistrictToDivisionsMap([multiGroupOffice]);

      const divisions = districtMap.get('999');
      expect(divisions).toBeDefined();
      expect(divisions).toHaveLength(2);
      expect(divisions!.map((d) => d.divisionCode)).toEqual(['DIV1', 'DIV2']);
    });

    test('should handle offices with divisions for multiple districts', () => {
      const multiDistrictOffice: UstpOfficeDetails = {
        officeCode: 'USTP_REGION_99_MULTI_DISTRICT',
        officeName: 'Multi-District',
        idpGroupName: 'USTP REGION 99 MULTI DISTRICT',
        regionId: '99',
        regionName: 'Multi District Region',
        groups: [
          {
            groupDesignator: 'MD',
            divisions: [
              {
                divisionCode: 'D1A',
                court: {
                  courtId: '111',
                  courtName: 'District 1 Court',
                  state: 'XX',
                },
                courtOffice: {
                  courtOfficeCode: 'D1A',
                  courtOfficeName: 'District 1 Office A',
                },
              },
              {
                divisionCode: 'D2A',
                court: {
                  courtId: '222',
                  courtName: 'District 2 Court',
                  state: 'YY',
                },
                courtOffice: {
                  courtOfficeCode: 'D2A',
                  courtOfficeName: 'District 2 Office A',
                },
              },
            ],
          },
        ],
      };

      const districtMap = buildDistrictToDivisionsMap([multiDistrictOffice]);

      expect(districtMap.size).toBe(2);
      expect(districtMap.get('111')).toHaveLength(1);
      expect(districtMap.get('222')).toHaveLength(1);
      expect(districtMap.get('111')![0].divisionCode).toBe('D1A');
      expect(districtMap.get('222')![0].divisionCode).toBe('D2A');
    });
  });

  describe('DivisionInfo type', () => {
    test('should allow valid DivisionInfo structure', () => {
      const divisionInfo: DivisionInfo = {
        divisionCode: 'MAH',
        courtId: '081',
        courtName: 'United States Bankruptcy Court',
        courtDivisionName: 'Manhattan Office',
      };

      expect(divisionInfo.divisionCode).toBe('MAH');
      expect(divisionInfo.courtId).toBe('081');
      expect(divisionInfo.courtName).toBe('United States Bankruptcy Court');
      expect(divisionInfo.courtDivisionName).toBe('Manhattan Office');
    });
  });
});
