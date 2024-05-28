import { OfficeDetails } from '@common/cams/courts';

export function getOfficeList(officesList: OfficeDetails[]) {
  const mapOutput = officesList.map((court) => {
    return {
      value: court.courtDivisionCode,
      label: `${court.courtName} (${court.courtDivisionName})`,
    };
  });
  return mapOutput;
}
