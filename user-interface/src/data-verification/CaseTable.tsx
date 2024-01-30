import { CaseDetailType } from '@/lib/type-declarations/chapter-15';
import { getCaseNumber } from '@/lib/utils/formatCaseNumber';
import { SyntheticEvent, forwardRef, useImperativeHandle, useState } from 'react';
import { Link } from 'react-router-dom';

export type CaseTableImperative = {
  clearSelection: () => void;
};

interface CaseTableProps {
  id: string;
  cases: Array<CaseDetailType>;
  onSelect?: (bCase: CaseDetailType) => void;
}

function _CaseTable(props: CaseTableProps, CaseTableRef: React.Ref<CaseTableImperative>) {
  const { id, cases, onSelect } = props;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  function handleCaseSelection(e: SyntheticEvent<HTMLInputElement>) {
    const idx = parseInt(e.currentTarget.value);
    setSelectedIdx(idx);
    const bCase = cases[idx];
    if (onSelect) onSelect(bCase);
  }

  function clearSelection() {
    setSelectedIdx(null);
  }

  useImperativeHandle(CaseTableRef, () => ({
    clearSelection,
  }));

  return (
    <table className="usa-table usa-table--borderless" id={id} data-testid={id}>
      <thead>
        <tr>
          {onSelect && <th scope="col">Select</th>}
          <th scope="col">Case Number</th>
          <th scope="col">Case Title</th>
          <th scope="col">SSN/EIN</th>
          <th scope="col">Court</th>
          <th scope="col">Filed Date</th>
          <th scope="col">Chapter</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((bCase, idx) => {
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
                <Link target="_blank" to={`/case-detail/${bCase.caseId}`}>
                  {getCaseNumber(bCase.caseId)}
                </Link>
              </td>
              <td scope="row">{bCase.caseTitle}</td>
              <td scope="row">{taxId}</td>
              <td scope="row">{bCase.courtName}</td>
              <td scope="row">{bCase.dateFiled}</td>
              <td scope="row">{bCase.chapter}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export const CaseTable = forwardRef(_CaseTable);
