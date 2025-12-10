import { Staff } from './users';

//TODO: Some of these probably do not belong here
export type UstpOfficeDetails = {
  officeCode: string; // Active Directory Group name (for now) e.g. USTP_CAMS_My_Group_Name
  officeName: string; // https://www.justice.gov/ust/us-trustee-regions-and-offices and dxtr.constants.ts
  groups: UstpGroup[];
  idpGroupName: string; // Okta group name e.g. USTP CAMS My Group Name
  regionId: string; // DXTR AO_REGION
  regionName: string; // DXTR AO_REGION
  state?: string; // https://www.justice.gov/ust/us-trustee-regions-and-offices
  staff?: Staff[];
};

export type UstpGroup = {
  groupDesignator: string; // ACMS Group Office_Regions_and_Divisions.pdf
  divisions: UstpDivision[];
};

export type UstpDivision = {
  divisionCode: string; // ACMS Div Code Office_Regions_and_Divisions.pdf
  court: Court;
  courtOffice: CourtOffice;
};

type Court = {
  courtId: string; // DXTR AO_CS_DIV.COURT_ID
  courtName?: string; // DXTR AO_COURT.COURT_NAME
  state?: string;
};

type CourtOffice = {
  courtOfficeCode: string; // DXTR AO_OFFICE.OFFICE_CODE
  courtOfficeName: string; // DXTR AO_OFFICE.OFFICE_DISPLAY_NAME
};

export function mapDivisionCodeToUstpOffice(
  offices: UstpOfficeDetails[],
): Map<string, UstpOfficeDetails> {
  return offices.reduce((acc, office) => {
    office.groups.forEach((group) => {
      group.divisions.forEach((division) => {
        acc.set(division.divisionCode, office);
      });
    });
    return acc;
  }, new Map<string, UstpOfficeDetails>());
}

export const MOCKED_USTP_OFFICES_ARRAY: UstpOfficeDetails[] = [
  {
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
    regionName: 'SEATTLE',
  },
  {
    officeCode: 'USTP_CAMS_Region_3_Office_Wilmington',
    idpGroupName: 'USTP CAMS Region 3 Office Wilmington',
    officeName: 'Wilmington',
    groups: [
      {
        groupDesignator: 'WL',
        divisions: [
          {
            divisionCode: '111',
            court: { courtId: '0311', courtName: 'District of Delaware', state: 'DE' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Delaware',
            },
          },
        ],
      },
    ],
    regionId: '3',
    regionName: 'PHILADELPHIA',
  },
  {
    officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    idpGroupName: 'USTP CAMS Region 2 Office Manhattan',
    officeName: 'Manhattan',
    groups: [
      {
        groupDesignator: 'NY',
        divisions: [
          {
            divisionCode: '081',
            court: { courtId: '0208', courtName: 'Southern District of New York', state: 'NY' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Manhattan',
            },
          },
          {
            divisionCode: '087',
            court: { courtId: '0208', courtName: 'Southern District of New York', state: 'NY' },
            courtOffice: {
              courtOfficeCode: '7',
              courtOfficeName: 'White Plains',
            },
          },
        ],
      },
    ],
    regionId: '2',
    regionName: 'NEW YORK',
  },
  {
    officeCode: 'USTP_CAMS_Region_2_Office_Buffalo',
    idpGroupName: 'USTP CAMS Region 2 Office Buffalo',
    officeName: 'Buffalo',
    groups: [
      {
        groupDesignator: 'BU',
        divisions: [
          {
            divisionCode: '091',
            court: { courtId: '0209', courtName: 'Western District of New York', state: 'NY' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Buffalo',
            },
          },
        ],
      },
    ],
    regionId: '2',
    regionName: 'NEW YORK',
  },
];

export const MOCKED_USTP_OFFICE_DATA_MAP = new Map<string, UstpOfficeDetails>(
  MOCKED_USTP_OFFICES_ARRAY.map((office) => [office.officeCode, office]),
);
