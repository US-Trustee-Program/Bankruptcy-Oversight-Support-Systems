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
  courtName: string; // DXTR AO_COURT.COURT_NAME
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
