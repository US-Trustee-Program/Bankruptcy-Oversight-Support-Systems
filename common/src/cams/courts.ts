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
        ustDivisionCode: division.ustDivisionCode,
        courtDivisionName: division.courtOffice.courtOfficeName,
        groupDesignator: group.groupDesignator,
        regionId: ustp.regionId,
        regionName: ustp.regionName,
        state: division.court.state,
      });
    });
    return acc;
  }, courtDivisions);
  return courtDivisions;
}

// CAMS-936. `ustDivisionCode` is the division identity used to match a case to a trustee
// appointment, so it has to be unique within its court. DXTR's CS_DIV_ACMS — what CAMS stores as
// courtDivisionCode — is not: in the Eastern District of Tennessee (0649) Winchester and
// Chattanooga both carry ACMS 491, and Johnson City and Greeneville both carry 492. The bare
// CS_DIV does tell them apart, so that is the code we emit there.
//
// Everywhere else ustDivisionCode stays equal to courtDivisionCode. Emitting the bare code
// nationwide would give newly synced cases a code nothing else in CAMS speaks — caseId prefixes,
// stored TRUSTEE_APPOINTMENT documents and the office picker are all ACMS — and neither backfill
// migrates courts outside 0649, so those cases would silently stop matching. Eight other courts
// also collapse two or more divisions into one ACMS code; widening this list means migrating them
// in the same release — tracked as cams-06edp.
export const UST_DIVISION_CODE_COURT_IDS = ['0649'];

/**
 * The two division code spaces a division can be identified by.
 *
 * `divisionCode` is DXTR's CS_DIV_ACMS — the code CAMS has always stored on cases and embedded in
 * caseId prefixes. `ustDivisionCode` is the bare CS_DIV, which is unique within a court where the
 * ACMS code is not: in court 0649, Chattanooga and Winchester both carry ACMS 491, and Greeneville
 * and Johnson City both carry 492. See CAMS-936.
 */
export type DivisionCodes = {
  divisionCode?: string;
  ustDivisionCode?: string;
};

/**
 * Picks which of a division's two codes identifies it, for callers that must agree on one.
 *
 * A screen keys on `ustDivisionCode` when the data it filters stores that code — trustee
 * appointments do. It keys on `divisionCode` when the data stores ACMS, as cases and case search
 * do. The rule lives here because every place that builds an identity has to make the same choice:
 * combobox option values, "All" expansion, encoded selections and the user's default selection all
 * have to produce the same code for the same division, or a user's office silently matches a
 * sibling division sharing its ACMS code.
 */
export function toDivisionCode(
  codes: DivisionCodes,
  useUstDivisionCode: boolean,
): string | undefined {
  return useUstDivisionCode ? (codes.ustDivisionCode ?? codes.divisionCode) : codes.divisionCode;
}

/** `toDivisionCode` for the flattened shape, where the ACMS code is named courtDivisionCode. */
export function toCourtDivisionCode(
  court: Pick<CourtDivisionDetails, 'courtDivisionCode' | 'ustDivisionCode'>,
  useUstDivisionCode: boolean,
): string {
  return toDivisionCode(
    { divisionCode: court.courtDivisionCode, ustDivisionCode: court.ustDivisionCode },
    useUstDivisionCode,
  )!;
}

export type CourtDivisionDetails = {
  officeName: string;
  officeCode: string;
  courtId: string;
  courtName: string;
  courtDivisionCode: string;
  ustDivisionCode?: string;
  courtDivisionName: string;
  groupDesignator: string;
  regionId: string;
  regionName: string;
  state?: string;
  staff?: CamsUserReference[];
};
