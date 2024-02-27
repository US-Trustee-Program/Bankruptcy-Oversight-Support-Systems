import { OfficeDetails } from '@common/cams/courts';

export function getOfficeList(officesList: OfficeDetails[]) {
  const mapOutput = officesList.map((court) => {
    return {
      value: court.courtDivision,
      label: `${court.courtName} (${court.courtDivisionName})`,
    };
  });
  mapOutput.splice(0, 0, { value: '', label: ' ' });
  return mapOutput;
}
