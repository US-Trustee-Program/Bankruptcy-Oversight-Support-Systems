import { TableHeader, TableHeaderData } from '@/lib/components/uswds/Table';
import { SearchResultsHeaderProps } from '@/search-results/SearchResults';

export function SearchResultsHeader(props: SearchResultsHeaderProps) {
  const { id } = props;
  return (
    <TableHeader className="case-headings" id={id}>
      <TableHeaderData className="grid-col-3" sortDirection="descending">
        {props.labels[0]}
      </TableHeaderData>
      <TableHeaderData className="grid-col-3">{props.labels[1]}</TableHeaderData>
      <TableHeaderData className="grid-col-1">{props.labels[2]}</TableHeaderData>
      <TableHeaderData className="grid-col-1" sortDirection="descending">
        {props.labels[3]}
      </TableHeaderData>
    </TableHeader>
  );
}
