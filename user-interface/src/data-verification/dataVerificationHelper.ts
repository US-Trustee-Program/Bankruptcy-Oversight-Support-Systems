import { CourtDivisionDetails } from '@common/cams/courts';

export function getOfficeList(officesList: CourtDivisionDetails[]) {
  const mapOutput = officesList.map((court) => {
    let label = `${court.courtName} (${court.courtDivisionName})`;
    if (court.isLegacy) {
      label = label + ' Legacy';
    }
    return {
      value: court.courtDivisionCode,
      label,
    };
  });
  return mapOutput;
}

export function courtSorter(a: CourtDivisionDetails, b: CourtDivisionDetails) {
  const aKey = a.courtName + '-' + a.courtDivisionName;
  const bKey = b.courtName + '-' + b.courtDivisionName;
  if (aKey === bKey) return 0;
  return aKey > bKey ? 1 : -1;
}
