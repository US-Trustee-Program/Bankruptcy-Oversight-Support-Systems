import { ComboOption } from '@/lib/components/combobox/ComboBox';
import { CourtDivisionDetails } from '@common/cams/courts';

export function getDivisionComboOptions(officesList: CourtDivisionDetails[]): ComboOption[] {
  return officesList.map((court) => {
    const label = `${court.courtName} (${court.courtDivisionName})`;
    return {
      value: court.courtDivisionCode,
      label,
      selectedLabel: `${court.courtDivisionName}, ${court.state}`,
    };
  });
}

export function courtSorter(a: CourtDivisionDetails, b: CourtDivisionDetails) {
  const aKey = a.state + '-' + a.courtName + '-' + a.courtDivisionName;
  const bKey = b.state + '-' + b.courtName + '-' + b.courtDivisionName;
  if (aKey === bKey) {
    return 0;
  }
  return aKey > bKey ? 1 : -1;
}
