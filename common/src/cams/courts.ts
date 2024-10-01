import { CamsUserReference } from './users';

export function ustpOfficeToCourtOffice(ustp: UstpOfficeDetails): CourtOfficeDetails[] {
  const courtOffices: CourtOfficeDetails[] = [];
  ustp.groups.reduce((acc, group) => {
    group.divisions.forEach((division) => {
      acc.push({
        officeName: division.courtOffice.courtOfficeName,
        officeCode: division.courtOffice.courtOfficeCode,
        courtId: division.court.courtId,
        courtName: division.court.courtName,
        courtDivisionCode: division.divisionCode,
        // TODO: Fix this gap in the mapping to court division name.?? Redundant to courtName?
        courtDivisionName: division.court.courtName, // Is this mapping correct??
        groupDesignator: group.groupDesignator,
        regionId: ustp.regionId,
        regionName: ustp.regionName,
      });
    });
    return acc;
  }, courtOffices);
  return courtOffices;
}

//TODO: Start switching this over to use this
export type CourtOfficeDetails = OfficeDetails;
export interface OfficeDetails {
  officeName: string;
  officeCode: string;
  courtId: string;
  courtName: string;
  courtDivisionCode: string;
  courtDivisionName: string;
  groupDesignator: string;
  regionId: string;
  regionName: string;
  state?: string;
  staff?: CamsUserReference[];
}

//TODO: Some of these probably do not belong here
export type UstpOfficeDetails = {
  officeCode: string; // Active Directory Group name (for now)
  officeName: string; // https://www.justice.gov/ust/us-trustee-regions-and-offices and dxtr.constants.ts
  groups: UstpGroup[];
  idpGroupId: string; // Okta
  regionId: string; // DXTR AO_REGION
  regionName: string; // DXTR AO_REGION
  state?: string; // https://www.justice.gov/ust/us-trustee-regions-and-offices
  staff?: CamsUserReference[];
};

export type UstpGroup = {
  groupDesignator: string; // ACMS Group Office_Regions_and_Divisions.pdf
  divisions: UstpDivision[];
};

export type UstpDivision = {
  divisionCode: string; // ACMS Div Code Office_Regions_and_Divisions.pdf
  court: Court;
  courtOffice: CourtOffice; // DXTR AO_CS_DIV.OFFICE_CODE
};

export type Court = {
  courtId: string; // DXTR AO_CS_DIV.COURT_ID
  courtName?: string; // DXTR
};

export type CourtOffice = {
  courtOfficeCode: string;
  courtOfficeName: string;
};

export function filterCourtByDivision(divisionCode: string, officeList: OfficeDetails[]) {
  const divisionOffice = officeList.find((office) => office.courtDivisionCode === divisionCode);
  if (divisionOffice) {
    return officeList.filter((office) => office.courtId === divisionOffice.courtId);
  } else {
    return null;
  }
}

export const USTP_OFFICES_ARRAY: UstpOfficeDetails[] = [
  {
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
  },
  {
    officeCode: 'USTP_CAMS_Region_3_Office_Wilmington',
    idpGroupId: 'USTP CAMS Region 3 Office Wilmington',
    officeName: 'Wilmington',
    groups: [
      {
        groupDesignator: 'WL',
        divisions: [
          {
            divisionCode: '111',
            court: { courtId: '0311', courtName: 'District of Delaware' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Wilmington',
            },
          },
        ],
      },
    ],
    regionId: '3',
    regionName: 'Philadelphia',
  },
  {
    officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
    idpGroupId: 'USTP CAMS Region 2 Office Manhattan',
    officeName: 'Manhattan',
    groups: [
      {
        groupDesignator: 'NY',
        divisions: [
          {
            divisionCode: '081',
            court: { courtId: '0208', courtName: 'Southern District of New York' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Manhattan',
            },
          },
          {
            divisionCode: '087',
            court: { courtId: '0208', courtName: 'Southern District of New York' },
            courtOffice: {
              courtOfficeCode: '7',
              courtOfficeName: 'White Plains',
            },
          },
        ],
      },
    ],
    regionId: '2',
    regionName: 'New York',
  },
  {
    officeCode: 'USTP_CAMS_Region_2_Office_Buffalo',
    idpGroupId: 'USTP CAMS Region 2 Office Buffalo',
    officeName: 'Buffalo',
    groups: [
      {
        groupDesignator: 'BU',
        divisions: [
          {
            divisionCode: '091',
            court: { courtId: '0209', courtName: 'Western District of New York' },
            courtOffice: {
              courtOfficeCode: '1',
              courtOfficeName: 'Buffalo',
            },
          },
        ],
      },
    ],
    regionId: '2',
    regionName: 'New York',
  },
];

export const USTP_OFFICE_DATA_MAP = new Map<string, UstpOfficeDetails>(
  USTP_OFFICES_ARRAY.map((office) => [office.officeCode, office]),
);
