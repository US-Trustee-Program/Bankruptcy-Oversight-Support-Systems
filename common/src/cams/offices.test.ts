import {
  mapDivisionCodeToUstpOffice,
  UstpOfficeDetails,
  MOCKED_USTP_OFFICES_ARRAY,
} from './offices';

describe('offices tests', () => {
  describe('mapDivisionCodeToUstpOffice', () => {
    test('should return an empty map when given an empty array', () => {
      const result = mapDivisionCodeToUstpOffice([]);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test('should correctly map division codes to their corresponding USTP offices', () => {
      // Create a simple test array with one office
      const testOffices: UstpOfficeDetails[] = [
        {
          officeCode: 'USTP_CAMS_Test_Office',
          idpGroupName: 'USTP CAMS Test Office',
          officeName: 'Test Office',
          groups: [
            {
              groupDesignator: 'TEST',
              divisions: [
                {
                  divisionCode: 'TEST1',
                  court: { courtId: '1234', courtName: 'Test District Court' },
                  courtOffice: {
                    courtOfficeCode: '1',
                    courtOfficeName: 'Test Court Office',
                  },
                },
                {
                  divisionCode: 'TEST2',
                  court: { courtId: '5678', courtName: 'Another Test District Court' },
                  courtOffice: {
                    courtOfficeCode: '2',
                    courtOfficeName: 'Another Test Court Office',
                  },
                },
              ],
            },
          ],
          regionId: 'TEST',
          regionName: 'TEST REGION',
        },
      ];

      const result = mapDivisionCodeToUstpOffice(testOffices);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('TEST1')).toBe(testOffices[0]);
      expect(result.get('TEST2')).toBe(testOffices[0]);
    });

    test('should handle multiple offices with multiple groups and divisions', () => {
      const result = mapDivisionCodeToUstpOffice(MOCKED_USTP_OFFICES_ARRAY);

      // Check a few division codes from the mock data
      expect(result.get('812')).toBe(MOCKED_USTP_OFFICES_ARRAY[0]); // Seattle office
      expect(result.get('730')).toBe(MOCKED_USTP_OFFICES_ARRAY[0]); // Seattle office (Alaska division)
      expect(result.get('111')).toBe(MOCKED_USTP_OFFICES_ARRAY[1]); // Wilmington office
      expect(result.get('081')).toBe(MOCKED_USTP_OFFICES_ARRAY[2]); // Manhattan office
      expect(result.get('091')).toBe(MOCKED_USTP_OFFICES_ARRAY[3]); // Buffalo office

      // Verify the total number of mappings
      let expectedSize = 0;
      MOCKED_USTP_OFFICES_ARRAY.forEach((office) => {
        office.groups.forEach((group) => {
          expectedSize += group.divisions.length;
        });
      });
      expect(result.size).toBe(expectedSize);
    });
  });
});
