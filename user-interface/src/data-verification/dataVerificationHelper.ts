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

export function validateCaseNumberInput(ev: React.ChangeEvent<HTMLInputElement>) {
  const allowedCharsPattern = /[0-9]/g;
  const filteredInput = ev.target.value.match(allowedCharsPattern) ?? [];
  if (filteredInput.length > 7) {
    filteredInput.splice(7);
  }
  if (filteredInput.length > 2) {
    filteredInput.splice(2, 0, '-');
  }
  const joinedInput = filteredInput?.join('') || '';
  const caseNumberPattern = /^\d{2}-\d{5}$/;
  const caseNumber = caseNumberPattern.test(joinedInput) ? joinedInput : undefined;
  return { caseNumber, joinedInput };
}
