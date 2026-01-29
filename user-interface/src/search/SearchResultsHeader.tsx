import { TableHeader, TableHeaderData } from '@/lib/components/uswds/Table';
import { SearchResultsHeaderProps } from '@/search-results/SearchResults';

export function SearchResultsHeader(props: SearchResultsHeaderProps) {
  const { id, showDebtorNameColumn = false } = props;

  // Define all header cells
  const caseNumberHeader = (
    <TableHeaderData
      key="case-number"
      data-testid="header-case-number"
      className={showDebtorNameColumn ? 'grid-col-2' : 'grid-col-3'}
    >
      {props.labels[0]}
    </TableHeaderData>
  );

  const caseTitleHeader = (
    <TableHeaderData
      key="case-title"
      data-testid="header-case-title"
      className={showDebtorNameColumn ? 'grid-col-3' : 'grid-col-4'}
    >
      {props.labels[1]}
    </TableHeaderData>
  );

  const debtorNameHeader = (
    <TableHeaderData key="debtor-name" data-testid="header-debtor-name" className="grid-col-3">
      {props.labels[2]}
    </TableHeaderData>
  );

  const chapterHeader = (
    <TableHeaderData key="chapter" data-testid="header-chapter" className="grid-col-2">
      {props.labels[showDebtorNameColumn ? 3 : 2]}
    </TableHeaderData>
  );

  const dateFiledHeader = (
    <TableHeaderData
      key="date-filed"
      data-testid="header-date-filed"
      className={showDebtorNameColumn ? 'grid-col-2' : 'grid-col-3'}
    >
      {props.labels[showDebtorNameColumn ? 4 : 3]}
    </TableHeaderData>
  );

  // Conditionally construct header array
  const headers = showDebtorNameColumn
    ? [caseNumberHeader, caseTitleHeader, debtorNameHeader, chapterHeader, dateFiledHeader]
    : [caseNumberHeader, caseTitleHeader, chapterHeader, dateFiledHeader];

  return (
    <TableHeader id={id} className="case-headings">
      {headers}
    </TableHeader>
  );
}
