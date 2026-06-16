import { type JSX } from 'react';
import { CamsTableCell, CamsTableRow } from '@/lib/components/cams/CamsTable';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { SearchResultsRowProps } from '@/search-results/SearchResults';
import { isCaseClosed } from '@common/cams/cases';

function formatDebtorNames(debtorName: string, jointDebtorName?: string): JSX.Element {
  if (!jointDebtorName) {
    return <>{debtorName}</>;
  }

  return (
    <>
      <div>Debtor: {debtorName}</div>
      <div>Joint Debtor: {jointDebtorName}</div>
    </>
  );
}

export function SearchResultsRow(props: SearchResultsRowProps) {
  const {
    bCase,
    idx,
    rank,
    labels,
    showDebtorNameColumn = false,
    showOpenClosedColumn = false,
    onCaseClick,
  } = props;

  const caseNumberCell = (
    <CamsTableCell key="case-number" className="col-case-number" data-cell={labels[0]}>
      <span className="no-wrap">
        <CaseNumber
          caseId={bCase.caseId}
          data-testid={`case-number-${bCase.caseId}`}
          onClick={onCaseClick ? () => onCaseClick(bCase, rank ?? idx + 1) : undefined}
        />{' '}
        ({bCase.courtDivisionName})
      </span>
    </CamsTableCell>
  );

  const caseTitleCell = (
    <CamsTableCell key="case-title" className="col-case-title" data-cell={labels[1]}>
      {bCase.caseTitle}
    </CamsTableCell>
  );

  const debtorNameCell = (
    <CamsTableCell key="debtor-name" className="col-debtor-name" data-cell={labels[2]}>
      {formatDebtorNames(bCase.debtor?.name ?? '', bCase.jointDebtor?.name)}
    </CamsTableCell>
  );

  const chapterCell = (
    <CamsTableCell
      key="chapter"
      className="col-chapter"
      data-cell={labels[showDebtorNameColumn ? 3 : 2]}
    >
      {bCase.chapter}
    </CamsTableCell>
  );

  const dateFiledCell = (
    <CamsTableCell
      key="date-filed"
      className="col-date-filed"
      data-cell={labels[showDebtorNameColumn ? 4 : 3]}
    >
      {formatDate(bCase.dateFiled)}
    </CamsTableCell>
  );

  const openClosedCell = (
    <CamsTableCell
      key="open-closed"
      className="col-open-closed"
      data-cell={labels[labels.length - 1]}
    >
      {isCaseClosed(bCase) ? 'Closed' : 'Open'}
    </CamsTableCell>
  );

  const baseCells = showDebtorNameColumn
    ? [caseNumberCell, caseTitleCell, debtorNameCell, chapterCell, dateFiledCell]
    : [caseNumberCell, caseTitleCell, chapterCell, dateFiledCell];
  const cells = showOpenClosedColumn ? [...baseCells, openClosedCell] : baseCells;

  return <CamsTableRow>{cells}</CamsTableRow>;
}
