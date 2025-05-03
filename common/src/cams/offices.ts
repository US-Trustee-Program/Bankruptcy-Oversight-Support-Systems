import { Staff } from './users';

export type Court = {
  courtId: string; // DXTR AO_CS_DIV.COURT_ID
  courtName?: string; // DXTR AO_COURT.COURT_NAME
  state?: string;
};

export type CourtOffice = {
  courtOfficeCode: string; // DXTR AO_OFFICE.OFFICE_CODE
  courtOfficeName: string; // DXTR AO_OFFICE.OFFICE_DISPLAY_NAME
};

export type UstpDivision = UstpDivisionMeta & {
  court: Court;
  courtOffice: CourtOffice;
  divisionCode: string; // ACMS Div Code Office_Regions_and_Divisions.pdf
};

export type UstpDivisionMeta = {
  isLegacy?: true;
};

export type UstpGroup = {
  divisions: UstpDivision[];
  groupDesignator: string; // ACMS Group Office_Regions_and_Divisions.pdf
};

//TODO: Some of these probably do not belong here
export type UstpOfficeDetails = {
  groups: UstpGroup[];
  idpGroupName: string; // Okta group name e.g. USTP CAMS My Group Name
  officeCode: string; // Active Directory Group name (for now) e.g. USTP_CAMS_My_Group_Name
  officeName: string; // https://www.justice.gov/ust/us-trustee-regions-and-offices and dxtr.constants.ts
  regionId: string; // DXTR AO_REGION
  regionName: string; // DXTR AO_REGION
  staff?: Staff[];
  state?: string; // https://www.justice.gov/ust/us-trustee-regions-and-offices
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
    regionName: 'SEATTLE',
  },
  {
    groups: [
      {
        divisions: [
          {
            court: { courtId: '0311', courtName: 'District of Delaware', state: 'DE' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Delaware',
            },
            divisionCode: '111',
          },
        ],
        groupDesignator: 'WL',
      },
    ],
    idpGroupName: 'USTP CAMS Region 3 Office Wilmington',
    officeCode: 'USTP_CAMS_Region_3_Office_Wilmington',
    officeName: 'Wilmington',
    regionId: '3',
    regionName: 'PHILADELPHIA',
  },
  {
    groups: [
      {
        divisions: [
          {
            court: { courtId: '0208', courtName: 'Southern District of New York', state: 'NY' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Manhattan',
            },
            divisionCode: '081',
          },
          {
            court: { courtId: '0208', courtName: 'Southern District of New York', state: 'NY' },
            courtOffice: {
              courtOfficeCode: '7',
              courtOfficeName: 'White Plains',
            },
            divisionCode: '087',
          },
        ],
        groupDesignator: 'NY',
      },
    ],
    idpGroupName: 'USTP CAMS Region 2 Office Manhattan',
    officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    officeName: 'Manhattan',
    regionId: '2',
    regionName: 'NEW YORK',
  },
  {
    groups: [
      {
        divisions: [
          {
            court: { courtId: '0209', courtName: 'Western District of New York', state: 'NY' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Buffalo',
            },
            divisionCode: '091',
          },
        ],
        groupDesignator: 'BU',
      },
    ],
    idpGroupName: 'USTP CAMS Region 2 Office Buffalo',
    officeCode: 'USTP_CAMS_Region_2_Office_Buffalo',
    officeName: 'Buffalo',
    regionId: '2',
    regionName: 'NEW YORK',
  },
];

export const MOCKED_USTP_OFFICE_DATA_MAP = new Map<string, UstpOfficeDetails>(
  MOCKED_USTP_OFFICES_ARRAY.map((office) => [office.officeCode, office]),
);
