import { TableRow, TableRowData } from '@/lib/components/uswds/Table';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { SearchResultsRowProps } from '@/search-results/SearchResults';

export function SearchResultsRow(props: SearchResultsRowProps) {
  const { bCase, ...otherProps } = props;

  return (
    <TableRow {...otherProps}>
      <TableRowData dataSortValue={bCase.caseId}>
        <span className="no-wrap">
          <CaseNumber caseId={bCase.caseId} /> ({bCase.courtDivisionName})
        </span>
      </TableRowData>
      <TableRowData>{bCase.caseTitle}</TableRowData>
      <TableRowData>{bCase.chapter}</TableRowData>
      <TableRowData>{formatDate(bCase.dateFiled)}</TableRowData>
    </TableRow>
  );
}
