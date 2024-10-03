import { CourtDivisionDetails, filterCourtByDivision, ustpOfficeToCourtDivision } from './courts';
import { COURT_DIVISIONS } from './test-utilities/courts.mock';
import { UstpOfficeDetails } from './offices';

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
    const newOfficeList = filterCourtByDivision('3N3', COURT_DIVISIONS);

    expect(newOfficeList.length).toEqual(2);
    expect(newOfficeList).toEqual(expect.arrayContaining([...expectedOffices]));
  });

  test('should filter court offices list by court division', async () => {
    const newOfficeList = filterCourtByDivision('555', COURT_DIVISIONS);
    expect(newOfficeList).toBeNull();
  });

  test('should map a ustp office to a court office', () => {
    const ustpOffice: UstpOfficeDetails = seattleOffice;
    const expectedCourtOffices: CourtDivisionDetails[] = [
      {
        courtDivisionCode: '812',
        courtDivisionName: 'Seattle',
        courtId: '0981',
        courtName: 'Western District of Washington',
        groupDesignator: 'SE',
        officeCode: '2',
        officeName: 'Seattle',
        regionId: '18',
        regionName: 'Seattle',
      },
      {
        courtDivisionCode: '813',
        courtDivisionName: 'Tacoma',
        courtId: '0981',
        courtName: 'Western District of Washington',
        groupDesignator: 'SE',
        officeCode: '3',
        officeName: 'Tacoma',
        regionId: '18',
        regionName: 'Seattle',
      },
      {
        courtDivisionCode: '710',
        courtDivisionName: 'Juneau',
        courtId: '097-',
        courtName: 'District of Alaska',
        groupDesignator: 'AK',
        officeCode: '1',
        officeName: 'Juneau',
        regionId: '18',
        regionName: 'Seattle',
      },
      {
        courtDivisionCode: '720',
        courtDivisionName: 'Nome',
        courtId: '097-',
        courtName: 'District of Alaska',
        groupDesignator: 'AK',
        officeCode: '2',
        officeName: 'Nome',
        regionId: '18',
        regionName: 'Seattle',
      },
      {
        courtDivisionCode: '730',
        courtDivisionName: 'Anchorage',
        courtId: '097-',
        courtName: 'District of Alaska',
        groupDesignator: 'AK',
        officeCode: '3',
        officeName: 'Anchorage',
        regionId: '18',
        regionName: 'Seattle',
      },
      {
        courtDivisionCode: '740',
        courtDivisionName: 'Fairbanks',
        courtId: '097-',
        courtName: 'District of Alaska',
        groupDesignator: 'AK',
        officeCode: '4',
        officeName: 'Fairbanks',
        regionId: '18',
        regionName: 'Seattle',
      },
      {
        courtDivisionCode: '750',
        courtDivisionName: 'Ketchikan',
        courtId: '097-',
        courtName: 'District of Alaska',
        groupDesignator: 'AK',
        officeCode: '5',
        officeName: 'Ketchikan',
        regionId: '18',
        regionName: 'Seattle',
      },
    ];
    const courtOffices = ustpOfficeToCourtDivision(ustpOffice);
    expect(courtOffices).toEqual(expectedCourtOffices);
  });
});

const seattleOffice = {
  officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
  idpGroupId: 'USTP CAMS Region 18 Office Seattle',
  officeName: 'Seattle',
  groups: [
    {
      groupDesignator: 'SE',
      divisions: [
        {
          divisionCode: '812',
          court: { courtId: '0981', courtName: 'Western District of Washington' },
          courtOffice: {
            courtOfficeCode: '2',
            courtOfficeName: 'Seattle',
          },
        },
        {
          divisionCode: '813',
          court: { courtId: '0981', courtName: 'Western District of Washington' },
          courtOffice: {
            courtOfficeCode: '3',
            courtOfficeName: 'Tacoma',
          },
        },
      ],
    },
    {
      groupDesignator: 'AK',
      divisions: [
        {
          divisionCode: '710',
          court: { courtId: '097-', courtName: 'District of Alaska' },
          courtOffice: {
            courtOfficeCode: '1',
            courtOfficeName: 'Juneau',
          },
        },
        {
          divisionCode: '720',
          court: { courtId: '097-', courtName: 'District of Alaska' },
          courtOffice: {
            courtOfficeCode: '2',
            courtOfficeName: 'Nome',
          },
        },
        {
          divisionCode: '730',
          court: { courtId: '097-', courtName: 'District of Alaska' },
          courtOffice: {
            courtOfficeCode: '3',
            courtOfficeName: 'Anchorage',
          },
        },
        {
          divisionCode: '740',
          court: { courtId: '097-', courtName: 'District of Alaska' },
          courtOffice: {
            courtOfficeCode: '4',
            courtOfficeName: 'Fairbanks',
          },
        },
        {
          divisionCode: '750',
          court: { courtId: '097-', courtName: 'District of Alaska' },
          courtOffice: {
            courtOfficeCode: '5',
            courtOfficeName: 'Ketchikan',
          },
        },
      ],
    },
  ],
  regionId: '18',
  regionName: 'Seattle',
};
