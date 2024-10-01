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
        // TODO: Fix this gap in the mapping to court division name.
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
