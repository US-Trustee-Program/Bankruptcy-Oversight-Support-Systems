import { TableHeader, TableHeaderData } from '@/lib/components/uswds/Table';
import { SearchResultsHeaderProps } from '@/search-results/SearchResults';

export function SearchResultsHeader(props: SearchResultsHeaderProps) {
  const { id, phoneticSearchEnabled = false } = props;

  if (phoneticSearchEnabled) {
    // With Debtor Name column
    return (
      <TableHeader id={id} className="case-headings">
        <TableHeaderData className="grid-col-2">{props.labels[0]}</TableHeaderData>
        <TableHeaderData className="grid-col-3">{props.labels[1]}</TableHeaderData>
        <TableHeaderData className="grid-col-3">{props.labels[2]}</TableHeaderData>
        <TableHeaderData className="grid-col-2">{props.labels[3]}</TableHeaderData>
        <TableHeaderData className="grid-col-2">{props.labels[4]}</TableHeaderData>
      </TableHeader>
    );
  } else {
    // Without Debtor Name column - redistribute the space
    return (
      <TableHeader id={id} className="case-headings">
        <TableHeaderData className="grid-col-3">{props.labels[0]}</TableHeaderData>
        <TableHeaderData className="grid-col-4">{props.labels[1]}</TableHeaderData>
        <TableHeaderData className="grid-col-2">{props.labels[2]}</TableHeaderData>
        <TableHeaderData className="grid-col-3">{props.labels[3]}</TableHeaderData>
      </TableHeader>
    );
  }
}
