import { UstpDivisionMeta, UstpOfficeDetails } from './offices';
import { CamsUserReference } from './users';

export type CourtDivisionDetails = UstpDivisionMeta & {
  courtDivisionCode: string;
  courtDivisionName: string;
  courtId: string;
  courtName: string;
  groupDesignator: string;
  officeCode: string;
  officeName: string;
  regionId: string;
  regionName: string;
  staff?: CamsUserReference[];
  state?: string;
};

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
        courtDivisionCode: division.divisionCode,
        courtDivisionName: division.courtOffice.courtOfficeName,
        courtId: division.court.courtId,
        courtName: division.court.courtName,
        groupDesignator: group.groupDesignator,
        isLegacy: division.isLegacy,
        officeCode: division.courtOffice.courtOfficeCode,
        officeName: division.courtOffice.courtOfficeName,
        regionId: ustp.regionId,
        regionName: ustp.regionName,
        state: division.court.state,
      });
    });
    return acc;
  }, courtDivisions);
  return courtDivisions;
}
