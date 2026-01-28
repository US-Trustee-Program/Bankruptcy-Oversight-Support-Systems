import { TableHeader, TableHeaderData } from '@/lib/components/uswds/Table';
import { SearchResultsHeaderProps } from '@/search-results/SearchResults';

export function SearchResultsHeader(props: SearchResultsHeaderProps) {
  const { id, phoneticSearchEnabled = false } = props;

  // Define all header cells
  const caseNumberHeader = (
    <TableHeaderData
      key="case-number"
      className={phoneticSearchEnabled ? 'grid-col-2' : 'grid-col-3'}
    >
      {props.labels[0]}
    </TableHeaderData>
  );

  const caseTitleHeader = (
    <TableHeaderData
      key="case-title"
      className={phoneticSearchEnabled ? 'grid-col-3' : 'grid-col-4'}
    >
      {props.labels[1]}
    </TableHeaderData>
  );

  const debtorNameHeader = (
    <TableHeaderData key="debtor-name" className="grid-col-3">
      {props.labels[2]}
    </TableHeaderData>
  );

  const chapterHeader = (
    <TableHeaderData key="chapter" className="grid-col-2">
      {props.labels[phoneticSearchEnabled ? 3 : 2]}
    </TableHeaderData>
  );

  const dateFiledHeader = (
    <TableHeaderData
      key="date-filed"
      className={phoneticSearchEnabled ? 'grid-col-2' : 'grid-col-3'}
    >
      {props.labels[phoneticSearchEnabled ? 4 : 3]}
    </TableHeaderData>
  );

  // Conditionally construct header array
  const headers = phoneticSearchEnabled
    ? [caseNumberHeader, caseTitleHeader, debtorNameHeader, chapterHeader, dateFiledHeader]
    : [caseNumberHeader, caseTitleHeader, chapterHeader, dateFiledHeader];

  return (
    <TableHeader id={id} className="case-headings">
      {headers}
    </TableHeader>
  );
}
