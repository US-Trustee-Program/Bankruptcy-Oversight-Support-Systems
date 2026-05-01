import { UstpOfficeDetails } from '@common/cams/offices';

/**
 * Division information extracted from DXTR offices data
 */
export type DivisionInfo = {
  divisionCode: string;
  courtId: string;
  courtName: string;
  courtDivisionName: string;
};

/**
 * Build a map from district code (courtId) to array of divisions.
 * This allows us to expand ATS district appointments into multiple division-specific appointments.
 *
 * @param offices - Array of USTP office details from DXTR
 * @returns Map of district code → divisions
 */
export function buildDistrictToDivisionsMap(
  offices: UstpOfficeDetails[],
): Map<string, DivisionInfo[]> {
  const districtMap = new Map<string, DivisionInfo[]>();

  for (const office of offices) {
    for (const group of office.groups) {
      for (const division of group.divisions) {
        const courtId = division.court.courtId;
        const divisionInfo: DivisionInfo = {
          divisionCode: division.divisionCode,
          courtId,
          courtName: division.court.courtName,
          courtDivisionName: division.courtOffice.courtOfficeName,
        };

        if (!districtMap.has(courtId)) {
          districtMap.set(courtId, []);
        }

        districtMap.get(courtId)!.push(divisionInfo);
      }
    }
  }

  return districtMap;
}
