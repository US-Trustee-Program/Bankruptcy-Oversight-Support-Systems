import React from 'react';

function safeToInt(s: string) {
  const intVal = parseInt(s);
  if (isNaN(intVal)) return s;

  return intVal.toString();
}

interface CaseSelectionAttributes {
  courtDivisionName: string;
  region: string;
}

interface CaseSelectionProps {
  fromCourt: CaseSelectionAttributes;
  toCourt: Partial<CaseSelectionAttributes>;
}

export function CaseSelection(props: CaseSelectionProps) {
  const { fromCourt, toCourt } = props;

  return (
    <>
      USTP Office: transfer from
      <span className="from-location transfer-highlight__span">
        Region {safeToInt(fromCourt.region)} - {fromCourt.courtDivisionName}
      </span>
      {toCourt.region && toCourt.courtDivisionName && (
        <>
          to
          <span className="to-location transfer-highlight__span">
            Region {safeToInt(toCourt.region)} - {toCourt.courtDivisionName}
          </span>
        </>
      )}
    </>
  );
}
