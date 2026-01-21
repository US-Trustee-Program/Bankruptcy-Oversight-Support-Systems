import { type JSX } from 'react';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { SearchResultsRowProps } from '@/search-results/SearchResults';

/**
 * Format debtor names for display in search results
 * Shows both debtor and joint debtor with role labels if both exist
 */
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
  const { bCase, labels, ...otherProps } = props;

  return (
    <TableRow {...otherProps}>
      <TableRowData dataLabel={labels[0]}>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData dataLabel={labels[1]}>
        {formatDebtorNames(bCase.debtor.name, bCase.jointDebtor?.name)}
      </TableRowData>
      <TableRowData dataLabel={labels[2]}>{bCase.caseTitle}</TableRowData>
      <TableRowData dataLabel={labels[3]}>{bCase.chapter}</TableRowData>
      <TableRowData dataLabel={labels[4]}>{formatDate(bCase.dateFiled)}</TableRowData>
    </TableRow>
  );
}
