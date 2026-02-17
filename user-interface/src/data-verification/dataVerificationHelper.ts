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
