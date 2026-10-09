import { CourtDivisionDetails, filterCourtByDivision, ustpOfficeToCourtDivision } from './courts';
import { COURT_DIVISIONS } from './test-utilities/courts.mock';
import { UstpOfficeDetails } from './offices';

const seattleOffice = {
  officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
  idpGroupName: 'USTP CAMS Region 18 Office Seattle',
  officeName: 'Seattle',
  groups: [
    {
      groupDesignator: 'SE',
      divisions: [
        {
          divisionCode: '812',
          court: { courtId: '0981', courtName: 'Western District of Washington', state: 'WA' },
          courtOffice: {
            courtOfficeCode: '2',
            courtOfficeName: 'Seattle',
          },
        },
        {
          divisionCode: '813',
          court: { courtId: '0981', courtName: 'Western District of Washington', state: 'WA' },
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
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '1',
            courtOfficeName: 'Juneau',
          },
        },
        {
          divisionCode: '720',
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '2',
            courtOfficeName: 'Nome',
          },
        },
        {
          divisionCode: '730',
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '3',
            courtOfficeName: 'Anchorage',
          },
        },
        {
          divisionCode: '740',
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
          courtOffice: {
            courtOfficeCode: '4',
            courtOfficeName: 'Fairbanks',
          },
        },
        {
          divisionCode: '750',
          court: { courtId: '097-', courtName: 'District of Alaska', state: 'AK' },
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

describe('common court library tests', () => {
  test.each([
    {
      label: 'returns all divisions sharing the matched division’s courtId',
      divisionCode: '710', // Juneau — District of Alaska has 5 divisions under courtId '097-'
      expectedCourtDivisionCodes: ['710', '720', '730', '740', '750'],
    },
    {
      label: 'returns a single division when only one shares the courtId',
      divisionCode: '313', // Baton Rouge — Middle District of Louisiana has only 1 division
      expectedCourtDivisionCodes: ['313'],
    },
  ])('$label', ({ divisionCode, expectedCourtDivisionCodes }) => {
    const result = filterCourtByDivision(divisionCode, COURT_DIVISIONS)!;

    expect(result).toBeDefined();
    expect(result.map((o) => o.courtDivisionCode).sort()).toEqual(
      [...expectedCourtDivisionCodes].sort(),
    );
    // Every returned office must share the matched division's courtId — the function's
    // actual value beyond a simple find().
    const courtId = result[0].courtId;
    expect(result.every((o) => o.courtId === courtId)).toBe(true);
  });

  test('should filter court offices list by court division #2', () => {
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

  test('should carry ustDivisionCode through separately from courtDivisionCode', () => {
    const easternTnOffice: UstpOfficeDetails = {
      officeCode: 'USTP_CAMS_Region_04_Office_Nashville',
      idpGroupName: 'USTP CAMS Region 04 Office Nashville',
      officeName: 'Nashville',
      regionId: '4',
      regionName: 'Atlanta',
      groups: [
        {
          groupDesignator: 'TN',
          divisions: [
            {
              divisionCode: '491',
              ustDivisionCode: '491',
              court: { courtId: '0649', courtName: 'Eastern District of Tennessee' },
              courtOffice: { courtOfficeCode: '1', courtOfficeName: 'Chattanooga' },
            },
            {
              divisionCode: '491',
              ustDivisionCode: '494',
              court: { courtId: '0649', courtName: 'Eastern District of Tennessee' },
              courtOffice: { courtOfficeCode: '4', courtOfficeName: 'Winchester' },
            },
          ],
        },
      ],
    };

    const courtOffices = ustpOfficeToCourtDivision(easternTnOffice);

    expect(
      courtOffices.map((c) => ({ code: c.courtDivisionCode, ust: c.ustDivisionCode })),
    ).toEqual([
      { code: '491', ust: '491' },
      { code: '491', ust: '494' },
    ]);
  });
});
