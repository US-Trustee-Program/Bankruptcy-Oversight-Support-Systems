import { filterCourtByDivision } from './courts';
import { OFFICES } from './test-utilities/offices.mock';

describe('common court library tests', () => {
  test('should filter court offices list by court division', async () => {
    const expected2ndOffice = {
      courtId: '001-',
      courtName: 'Test District Group 0',
      courtDivisionCode: 'G00',
      courtDivisionName: 'Ketchikan',
      groupDesignator: 'GP',
      officeCode: '1',
      officeName: '',
      regionId: '01',
      regionName: 'SEATTLE',
      state: 'AK',
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
