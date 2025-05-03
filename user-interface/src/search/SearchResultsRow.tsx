import { CaseNumber } from '@/lib/components/CaseNumber';
import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { formatDate } from '@/lib/utils/datetime';
import { SearchResultsRowProps } from '@/search-results/SearchResults';

export function SearchResultsRow(props: SearchResultsRowProps) {
  const { bCase, labels, ...otherProps } = props;

  return (
    <TableRow {...otherProps}>
      <TableRowData dataLabel={labels[0]} dataSortValue={bCase.caseId.replace(/-/g, '')}>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData dataLabel={labels[1]}>{bCase.caseTitle}</TableRowData>
      <TableRowData dataLabel={labels[2]}>{bCase.chapter}</TableRowData>
      <TableRowData dataLabel={labels[3]} dataSortValue={bCase.dateFiled.replace(/-/g, '')}>
        {formatDate(bCase.dateFiled)}
      </TableRowData>
    </TableRow>
  );
}
