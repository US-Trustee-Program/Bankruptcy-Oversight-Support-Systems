import { UstpOfficeDetails } from './offices';
import { CamsUserReference } from './users';

export function filterCourtByDivision(divisionCode: string, officeList: CourtDivisionDetails[]) {
  const divisionOffice = officeList.find((office) => office.courtDivisionCode === divisionCode);
  if (divisionOffice) {
    return officeList.filter((office) => office.courtId === divisionOffice.courtId);
  } else {
    return null;
  }
}

export function ustpOfficeToCourtDivision(ustp: UstpOfficeDetails): CourtDivisionDetails[] {
  const courtDivisions: CourtDivisionDetails[] = [];
  ustp.groups.reduce((acc, group) => {
    group.divisions.forEach((division) => {
      acc.push({
        officeName: division.courtOffice.courtOfficeName,
        officeCode: division.courtOffice.courtOfficeCode,
        courtId: division.court.courtId,
        courtName: division.court.courtName,
        courtDivisionCode: division.divisionCode,
        courtDivisionName: division.courtOffice.courtOfficeName,
        groupDesignator: group.groupDesignator,
        regionId: ustp.regionId,
        regionName: ustp.regionName,
        state: division.court.state || ('' as string),
      });
    });
    return acc;
  }, courtDivisions);
  return courtDivisions;
}

export type CourtDivisionDetails = {
  officeName: string;
  officeCode: string;
  courtId: string;
  courtName: string;
  courtDivisionCode: string;
  courtDivisionName: string;
  groupDesignator: string;
  regionId: string;
  regionName: string;
  state: string;
  staff?: CamsUserReference[];
};
