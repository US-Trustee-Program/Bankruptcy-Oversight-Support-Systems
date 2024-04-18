import { filterCourtByDivision } from './courts';
import { OFFICES } from './test-utilities/offices.mock';

describe('common court library tests', () => {
  test('should filter court offices list by court division', async () => {
    const expectedOffices = [
      {
        courtDivisionCode: '3N3',
        groupDesignator: 'NR',
        courtId: '053N',
        officeName: '',
        officeCode: '3',
        state: 'LA',
        courtName: 'Middle District of Louisiana',
        courtDivisionName: 'Baton Rouge',
        regionId: '05',
        regionName: 'NEW ORLEANS',
      },
      {
        courtDivisionCode: '3N4',
        groupDesignator: 'NR',
        courtId: '053N',
        officeName: '',
        officeCode: '4',
        state: 'LA',
        courtName: 'Middle District of Louisiana',
        courtDivisionName: 'Opelousas',
        regionId: '05',
        regionName: 'NEW ORLEANS',
      },
    ];
    const newOfficeList = filterCourtByDivision('3N3', OFFICES);

    expect(newOfficeList.length).toEqual(2);
    expect(newOfficeList).toEqual(expect.arrayContaining([...expectedOffices]));
  });

  test('should filter court offices list by court division', async () => {
    const newOfficeList = filterCourtByDivision('555', OFFICES);
    expect(newOfficeList).toBeNull();
  });
});
