import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { SearchResultsRowProps } from '@/search-results/SearchResults';

export function SearchResultsRow(props: SearchResultsRowProps) {
  const { bCase, labels, ...otherProps } = props;

  // Format debtor names with labels
  const debtorName = bCase.debtor?.name;
  const jointDebtorName = bCase.jointDebtor?.name;

  const debtorDisplay = (
    <>
      {debtorName && (
        <div>
          <strong>Debtor:</strong> {debtorName}
        </div>
      )}
      {jointDebtorName && (
        <div>
          <strong>Joint Debtor:</strong> {jointDebtorName}
        </div>
      )}
    </>
  );

  return (
    <TableRow {...otherProps}>
      <TableRowData dataLabel={labels[0]}>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData dataLabel={labels[1]}>{bCase.caseTitle}</TableRowData>
      <TableRowData dataLabel={labels[2]}>{debtorDisplay}</TableRowData>
      <TableRowData dataLabel={labels[3]}>{bCase.chapter}</TableRowData>
      <TableRowData dataLabel={labels[4]}>{formatDate(bCase.dateFiled)}</TableRowData>
    </TableRow>
  );
}
