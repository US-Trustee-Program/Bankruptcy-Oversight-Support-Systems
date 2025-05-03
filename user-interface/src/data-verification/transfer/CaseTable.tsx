import './CasesTable.scss';
import { CaseNumber } from '@/lib/components/CaseNumber';
import Radio from '@/lib/components/uswds/Radio';
import { formatDate } from '@/lib/utils/datetime';
import { CaseSummary } from '@common/cams/cases';
import { forwardRef, useImperativeHandle, useState } from 'react';

export type CaseTableImperative = {
  clearAllCheckboxes: () => void;
};

type CaseTableProps = {
  cases: Array<CaseSummary | null>;
  displayDocket?: boolean;
  id: string;
  onSelect?: (bCase: CaseSummary | null) => void;
};

function _CaseTable(props: CaseTableProps, CaseTableRef: React.Ref<CaseTableImperative>) {
  const { cases, id, onSelect } = props;

  const [selectedIdx, setSelectedIdx] = useState<null | number>(null);

  function handleCaseSelection(value: string) {
    const idx = parseInt(value);
    if (!isNaN(idx)) {
      setSelectedIdx(idx);
      const bCase = cases[idx];
      if (onSelect) onSelect(bCase);
    }
  }

  function clearAllCheckboxes() {
    setSelectedIdx(null);
  }

  useImperativeHandle(CaseTableRef, () => ({
    clearAllCheckboxes,
  }));

  return (
    <table className="usa-table usa-table--borderless" data-testid={id} id={id}>
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
              <tr data-testid={'empty-row'} key={'empty'}>
                <td>
                  <Radio
                    checked={idx === selectedIdx}
                    className="suggested-cases-radio-button"
                    data-testid={'suggested-cases-radio-empty'}
                    id={`case-not-listed-radio-button`}
                    label=""
                    name="case-selection"
                    onChange={handleCaseSelection}
                    title={`case not listed`}
                    value={idx}
                  />
                </td>
                <td colSpan={6}>Case not listed.</td>
              </tr>
            );
          }
          const taxId = bCase.debtor?.ssn || bCase.debtor?.taxId || '';
          const key = `${id}-row-${idx}`;
          return (
            <tr data-testid={key} key={key}>
              {onSelect && (
                <td>
                  <Radio
                    checked={idx === selectedIdx}
                    className="suggested-cases-radio-button"
                    data-testid={`${id}-radio-${idx}`}
                    id={`${id}-checkbox-${idx}`}
                    label=""
                    name="case-selection"
                    onChange={handleCaseSelection}
                    title={`select ${bCase.caseTitle}`}
                    value={idx}
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

export const CaseTable = forwardRef(_CaseTable);
