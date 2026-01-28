import { type JSX } from 'react';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { SearchResultsRowProps } from '@/search-results/SearchResults';

function formatDebtorNames(debtorName: string, jointDebtorName?: string): JSX.Element {
  if (!jointDebtorName) {
    return <>{debtorName}</>;
  }

  return (
    <>
      <div>{debtorName} (Debtor)</div>
      <div>{jointDebtorName} (Joint Debtor)</div>
    </>
  );
}

export function SearchResultsRow(props: SearchResultsRowProps) {
  const { bCase, labels, phoneticSearchEnabled = false, ...otherProps } = props;

  const caseNumberCell = (
    <TableRowData key="case-number" dataLabel={labels[0]}>
      <span className="no-wrap">
        <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
      </span>
    </TableRowData>
  );

  const caseTitleCell = (
    <TableRowData key="case-title" dataLabel={labels[1]}>
      {bCase.caseTitle}
    </TableRowData>
  );

  const debtorNameCell = (
    <TableRowData key="debtor-name" dataLabel={labels[2]}>
      {formatDebtorNames(bCase.debtor?.name ?? '', bCase.jointDebtor?.name)}
    </TableRowData>
  );

  const chapterCell = (
    <TableRowData key="chapter" dataLabel={labels[phoneticSearchEnabled ? 3 : 2]}>
      {bCase.chapter}
    </TableRowData>
  );

  const dateFiledCell = (
    <TableRowData key="date-filed" dataLabel={labels[phoneticSearchEnabled ? 4 : 3]}>
      {formatDate(bCase.dateFiled)}
    </TableRowData>
  );

  const cells = phoneticSearchEnabled
    ? [caseNumberCell, caseTitleCell, debtorNameCell, chapterCell, dateFiledCell]
    : [caseNumberCell, caseTitleCell, chapterCell, dateFiledCell];

  return <TableRow {...otherProps}>{cells}</TableRow>;
}
