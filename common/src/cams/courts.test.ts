import { CourtDivisionDetails, filterCourtByDivision, ustpOfficeToCourtDivision } from './courts';
import { UstpOfficeDetails } from './offices';
import { COURT_DIVISIONS } from './test-utilities/courts.mock';

describe('common court library tests', () => {
  test('should filter court offices list by court division', async () => {
    const expectedOffices = [
      {
        courtDivisionCode: '313',
        courtDivisionName: 'Baton Rouge',
        courtId: '053N',
        courtName: 'Middle District of Louisiana',
        groupDesignator: 'NR',
        officeCode: '3',
        officeName: 'Baton Rouge',
        regionId: '5',
        regionName: 'NEW ORLEANS',
        state: 'LA',
      },
    ];
    const newOfficeList = filterCourtByDivision('313', COURT_DIVISIONS);

    expect(newOfficeList.length).toEqual(1);
    expect(newOfficeList).toEqual(expect.arrayContaining([...expectedOffices]));
  });

  test('should filter court offices list by court division #2', async () => {
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
        state: 'WA',
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
        state: 'WA',
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
        state: 'AK',
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
        state: 'AK',
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
        state: 'AK',
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
        state: 'AK',
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
        state: 'AK',
      },
    ];
    const courtOffices = ustpOfficeToCourtDivision(ustpOffice);
    expect(courtOffices).toEqual(expectedCourtOffices);
  });
});

const seattleOffice = {
  groups: [
    {
      divisions: [
        {
          court: { courtId: '0981', courtName: 'Western District of Washington', state: 'WA' },
          courtOffice: {
            courtOfficeCode: '2',
            courtOfficeName: 'Seattle',
          },
          divisionCode: '812',
        },
        {
          court: { courtId: '0981', courtName: 'Western District of Washington', state: 'WA' },
          courtOffice: {
            courtOfficeCode: '3',
            courtOfficeName: 'Tacoma',
          },
          divisionCode: '813',
        },
      ],
      groupDesignator: 'SE',
    },
    {
      divisions: [
        {
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '1',
            courtOfficeName: 'Juneau',
          },
          divisionCode: '710',
        },
        {
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '2',
            courtOfficeName: 'Nome',
          },
          divisionCode: '720',
        },
        {
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '3',
            courtOfficeName: 'Anchorage',
          },
          divisionCode: '730',
        },
        {
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '4',
            courtOfficeName: 'Fairbanks',
          },
          divisionCode: '740',
        },
        {
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '5',
            courtOfficeName: 'Ketchikan',
          },
          divisionCode: '750',
        },
      ],
      groupDesignator: 'AK',
    },
  ],
  idpGroupName: 'USTP CAMS Region 18 Office Seattle',
  officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
  officeName: 'Seattle',
  regionId: '18',
  regionName: 'Seattle',
};
