import { filterCourtByDivision } from './courts';
import { OFFICES } from './test-utilities/offices.mock';

describe('common court library tests', () => {
  test('should filter court offices list by court division', async () => {
    const expected2ndOffice = {
      courtDivision: 'G00',
      groupDesignator: 'GP',
      courtId: '001-',
      officeName: '',
      officeCode: '1',
      state: 'AK',
      courtName: 'Test District Group 0',
      courtDivisionName: 'Ketchikan',
      regionId: '01',
      regionName: 'SEATTLE',
    };
    const newOfficeList = filterCourtByDivision('G00', OFFICES);

    expect(newOfficeList.length).toEqual(3);
    expect(newOfficeList[1]).toEqual(expected2ndOffice);
  });

  test('should filter court offices list by court division', async () => {
    const newOfficeList = filterCourtByDivision('555', OFFICES);
    expect(newOfficeList).toBeNull();
  });
});
