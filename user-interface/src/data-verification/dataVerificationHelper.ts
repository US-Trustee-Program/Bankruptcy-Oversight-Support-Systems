import { CourtDivisionDetails } from '@common/cams/courts';

export function getOfficeList(officesList: CourtDivisionDetails[]) {
  const mapOutput = officesList.map((court) => {
    return {
      value: court.courtDivisionCode,
      label: `${court.courtName} (${court.courtDivisionName})`,
    };
  });
  return mapOutput;
}
