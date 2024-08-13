import { TableHeader, TableHeaderData } from '@/lib/components/uswds/Table';
import { SearchResultsHeaderProps } from '@/search-results/SearchResults';

export function SearchResultsHeader(props: SearchResultsHeaderProps) {
  const { id } = props;
  return (
    <TableHeader id={id} className="case-headings">
      <TableHeaderData className="grid-col-3">Case Number (Division)</TableHeaderData>
      <TableHeaderData className="grid-col-3">Case Title</TableHeaderData>
      <TableHeaderData className="grid-col-1">Chapter</TableHeaderData>
      <TableHeaderData className="grid-col-1">Case Filed</TableHeaderData>
    </TableHeader>
  );
}
