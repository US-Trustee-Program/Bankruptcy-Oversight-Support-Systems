import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { CaseSummary } from '@common/cams/cases';
import { SyntheticEvent, forwardRef, useImperativeHandle, useState } from 'react';

export type CaseTableImperative = {
  clearAllCheckboxes: () => void;
};

type CaseTableProps = {
  id: string;
  cases: Array<CaseSummary | null>;
  onSelect?: (bCase: CaseSummary | null) => void;
  displayDocket?: boolean;
};

function _CaseTable(props: CaseTableProps, CaseTableRef: React.Ref<CaseTableImperative>) {
  const { id, cases, onSelect } = props;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  function handleCaseSelection(e: SyntheticEvent<HTMLInputElement>) {
    const idx = parseInt(e.currentTarget.value);
    setSelectedIdx(idx);
    const bCase = cases[idx];
    if (onSelect) onSelect(bCase);
  }

  function clearAllCheckboxes() {
    setSelectedIdx(null);
  }

  useImperativeHandle(CaseTableRef, () => ({
    clearAllCheckboxes,
  }));

  return (
    <table className="usa-table usa-table--borderless" id={id} data-testid={id}>
      <thead>
        <tr>
          {onSelect && <th scope="col">Select</th>}
          <th scope="col">Case Number</th>
          <th scope="col">Court (Division)</th>
          <th scope="col">Case Title</th>
          <th scope="col">Chapter</th>
          <th scope="col">Filed Date</th>
          <th scope="col">Tax ID</th>
        </tr>
      </thead>
      <tbody>
        {cases?.map((bCase, idx) => {
          if (!bCase) {
            if (!onSelect) return <></>;
            return (
              <tr key={'empty'} data-testid={'empty-row'}>
                <th scope="col">
                  <input
                    type="radio"
                    onChange={handleCaseSelection}
                    value={idx}
                    name="case-selection"
                    data-testid={`suggested-cases-radio-empty`}
                    checked={idx === selectedIdx}
                    title={`case not listed`}
                  ></input>
                </th>
                <td colSpan={6}>Case not listed.</td>
              </tr>
            );
          }
          const taxId = bCase.debtor?.ssn || bCase.debtor?.taxId || '';
          const key = `${id}-row-${idx}`;
          return (
            <tr key={key} data-testid={key}>
              {onSelect && (
                <th scope="col">
                  <input
                    type="radio"
                    onChange={handleCaseSelection}
                    value={idx}
                    name="case-selection"
                    data-testid={`${id}-radio-${idx}`}
                    checked={idx === selectedIdx}
                    title={`select ${bCase.caseTitle}`}
                  ></input>
                </th>
              )}
              <td scope="row">
                <CaseNumber caseId={bCase.caseId} />
              </td>
              <td scope="row">
                {bCase.courtName} ({bCase.courtDivisionName})
              </td>
              <td scope="row">{bCase.caseTitle}</td>
              <td scope="row">{bCase.chapter}</td>
              <td scope="row" className="text-no-wrap">
                {formatDate(bCase.dateFiled)}
              </td>
              <td scope="row" className="text-no-wrap">
                {taxId}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export const CaseTable = forwardRef(_CaseTable);
