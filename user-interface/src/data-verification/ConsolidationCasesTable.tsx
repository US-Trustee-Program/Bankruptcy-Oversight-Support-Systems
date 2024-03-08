import { CaseNumber } from '@/lib/components/CaseNumber';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { ConsolidationOrderCase } from '@common/cams/orders';
import { SyntheticEvent, forwardRef, useImperativeHandle, useState, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils/datetime';

export type OrderTableImperative = {
  clearSelection: () => void;
};

interface ConsolidationCaseTableProps {
  id: string;
  cases: Array<ConsolidationOrderCase>;
  onSelect: (bCase: ConsolidationOrderCase) => void;
  displayDocket?: boolean;
}

function _ConsolidationCaseTable(
  props: ConsolidationCaseTableProps,
  OrderTableRef: React.Ref<OrderTableImperative>,
) {
  const { id, cases, onSelect } = props;

  const [included, setIncluded] = useState<Array<number>>([]);

  function handleCaseSelection(e: SyntheticEvent<HTMLInputElement>) {
    const idx = parseInt(e.currentTarget.value);
    const newValue = [...included];
    if (newValue.includes(idx)) {
      setIncluded(newValue.filter((index) => index !== idx));
    } else {
      setIncluded([...included, idx]);
    }
    const _case = cases[idx];
    onSelect(_case);
  }

  function clearSelection() {
    setIncluded([]);
  }

  useImperativeHandle(OrderTableRef, () => ({
    clearSelection,
  }));

  return (
    <table className="usa-table usa-table--borderless" id={id} data-testid={id}>
      <thead>
        <tr>
          <th scope="col">Include</th>
          <th scope="col">Case Number (Division)</th>
          <th scope="col">Debtor</th>
          <th scope="col">Chapter</th>
          <th scope="col">Filed</th>
          <th scope="col">Assigned Staff</th>
        </tr>
      </thead>
      <tbody>
        {cases
          ?.reduce((accumulator: ReactNode[], bCase, idx) => {
            const key = `${id}-row-${idx}`;
            accumulator.push(
              <tr key={`${key}-case-info`} data-testid={`${key}-case-info`} className="case-info">
                <td scope="row">
                  <input
                    type="checkbox"
                    onChange={handleCaseSelection}
                    value={idx}
                    name="case-selection"
                    data-testid={`${id}-checkbox-${idx}`}
                    checked={included.includes(idx)}
                    title={`select ${bCase.caseTitle}`}
                  ></input>
                </td>
                <td scope="row">
                  <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
                </td>
                <td scope="row">{bCase.caseTitle}</td>
                <td scope="row" className="text-no-wrap">
                  {bCase.chapter}
                </td>
                <td scope="row">{formatDate(bCase.dateFiled)}</td>
                <td scope="row" className="text-no-wrap">
                  {''}
                </td>
              </tr>,
            );
            accumulator.push(
              <tr
                key={`${key}-docket-entry`}
                data-testid={`${key}-docket-entry`}
                className="docket-entry"
              >
                <td></td>
                <td colSpan={5} className="measure-6">
                  {!bCase.docketEntries && <>No docket entries</>}
                  {bCase.docketEntries &&
                    bCase.docketEntries.map((docketEntry, idx) => {
                      return (
                        <div key={`${key}-docket-entry-${idx}`}>
                          <Link
                            to={`/case-detail/${bCase.caseId}/court-docket?document=${docketEntry.documentNumber}`}
                            target="_blank"
                            title={`Open case ${bCase.caseId} docket in new window`}
                          >
                            {docketEntry.documentNumber && (
                              <span className="document-number">
                                #{docketEntry.documentNumber} -{' '}
                              </span>
                            )}
                            {bCase.courtName} - {docketEntry.summaryText}
                          </Link>
                          <p tabIndex={0} className="measure-6">
                            {docketEntry.fullText}
                          </p>
                          {docketEntry.documents && (
                            <DocketEntryDocumentList documents={docketEntry.documents} />
                          )}
                        </div>
                      );
                    })}
                </td>
              </tr>,
            );
            return accumulator;
          }, [])
          .map((node) => {
            return node;
          })}
      </tbody>
    </table>
  );
}

export const ConsolidationCaseTable = forwardRef(_ConsolidationCaseTable);
