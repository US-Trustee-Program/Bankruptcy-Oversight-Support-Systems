import './CasesTable.scss';
import { CaseNumber } from '@/lib/components/CaseNumber';
import Radio from '@/lib/components/uswds/Radio';
import { formatDate } from '@/lib/utils/datetime';
import { CaseSummary } from '@common/cams/cases';
import React, { forwardRef, useImperativeHandle, useState } from 'react';

export type CaseTableImperative = {
  clearAllCheckboxes: () => void;
};

type CaseTableProps = {
  id: string;
  cases: Array<CaseSummary | null>;
  onSelect?: (bCase: CaseSummary | null) => void;
};

function CaseTable_(props: CaseTableProps, CaseTableRef: React.Ref<CaseTableImperative>) {
  const { id, cases, onSelect } = props;

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  function handleCaseSelection(value: string) {
    const idx = Number.parseInt(value);
    if (!Number.isNaN(idx)) {
      setSelectedIdx(idx);
      const bCase = cases[idx];
      if (onSelect) {
        onSelect(bCase);
      }
    }
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
            if (!onSelect) {
              return null;
            }
            return (
              <tr key={'empty'} data-testid={'empty-row'}>
                <td>
                  <Radio
                    id={`case-not-listed-radio-button`}
                    name="case-selection"
                    label=""
                    title={`Case not listed`}
                    value={idx}
                    checked={idx === selectedIdx}
                    onChange={handleCaseSelection}
                    data-testid={'suggested-cases-radio-empty'}
                    className="suggested-cases-radio-button"
                  />
                </td>
                <td colSpan={6}>Case not listed.</td>
              </tr>
            );
          }
          const taxId = bCase.debtor?.ssn || bCase.debtor?.taxId || '';
          const key = `${id}-row-${idx}`;
          return (
            <tr key={key} data-testid={key}>
              {onSelect && (
                <td>
                  <Radio
                    id={`${id}-checkbox-${idx}`}
                    label=""
                    onChange={handleCaseSelection}
                    value={idx}
                    name="case-selection"
                    data-testid={`${id}-radio-${idx}`}
                    checked={idx === selectedIdx}
                    title={`Select ${bCase.caseTitle}`}
                    className="suggested-cases-radio-button"
                  />
                </td>
              )}
              <td>
                <CaseNumber
                  caseId={bCase.caseId}
                  data-testid={`case-detail-${bCase.caseId}-${id}`}
                />
              </td>
              <td>
                {bCase.courtName} ({bCase.courtDivisionName})
              </td>
              <td>{bCase.caseTitle}</td>
              <td>{bCase.chapter}</td>
              <td className="text-no-wrap">{formatDate(bCase.dateFiled)}</td>
              <td className="text-no-wrap">{taxId}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const CaseTable = forwardRef(CaseTable_);
export default CaseTable;
