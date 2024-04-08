export interface OfficeDetails {
  officeName: string;
  officeCode: string;
  courtId: string;
  // TODO: court to office relationship is not one-to-one, may need to refactor
  courtName: string;
  courtDivision: string;
  courtDivisionName: string;
  groupDesignator: string;
  regionId: string;
  regionName: string;
  state?: string;
}

export function filterCourtByDivision(divisionCode: string, officeList: OfficeDetails[]) {
  const divisionOffice = officeList.find((office) => office.courtDivision === divisionCode);
  if (divisionOffice) {
    return officeList.filter((office) => office.courtId === divisionOffice.courtId);
  } else {
    return null;
  }
}
