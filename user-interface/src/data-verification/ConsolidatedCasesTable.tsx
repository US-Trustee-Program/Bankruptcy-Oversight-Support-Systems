import { CaseNumber } from '@/lib/components/CaseNumber';
import DocketEntryDocumentList from '@/lib/components/DocketEntryDocumentList';
import { ConsolidationOrderCase } from '@common/cams/orders';
import { SyntheticEvent, forwardRef, useImperativeHandle, useState } from 'react';
import { Link } from 'react-router-dom';

export type OrderTableImperative = {
  clearSelection: () => void;
};

interface OrderTableProps {
  id: string;
  cases: Array<ConsolidationOrderCase>;
  onSelect: (bCase: ConsolidationOrderCase) => void;
  displayDocket?: boolean;
}

function _ConsolidatedCasesTable(
  props: OrderTableProps,
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
    // if (onSelect) onSelect(order);
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
        {cases?.map((bCase, idx) => {
          const key = `${id}-row-${idx}`;
          return (
            <>
              <tr key={`${key}`} data-testid={key}>
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
                  <CaseNumber caseNumber={bCase.caseId} /> ({bCase.courtDivisionName})
                </td>
                <td scope="row">{bCase.caseTitle}</td>
                <td scope="row" className="text-no-wrap">
                  {bCase.chapter}
                </td>
                <td scope="row">{bCase.dateFiled}</td>
                <td scope="row" className="text-no-wrap">
                  Ben Matlock
                </td>
              </tr>
              <tr key={`${key}-b`} data-testid={`${key}-b`}>
                <td> </td>
                <td colSpan={6} className="measure-6">
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
              </tr>
            </>
          );
        })}
      </tbody>
    </table>
  );
}

export const ConsolidatedCasesTable = forwardRef(_ConsolidatedCasesTable);
