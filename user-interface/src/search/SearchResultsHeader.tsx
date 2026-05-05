import { CamsTableHeader, CamsTableHeaderCell } from '@/lib/components/cams/CamsTable';
import { SearchResultsHeaderProps } from '@/search-results/SearchResults';

export function SearchResultsHeader(props: SearchResultsHeaderProps) {
  const { showDebtorNameColumn = false, showOpenClosedColumn = false } = props;

  const baseHeaders = showDebtorNameColumn
    ? [
        {
          key: 'case-number',
          testId: 'header-case-number',
          label: props.labels[0],
          className: 'col-case-number',
        },
        {
          key: 'case-title',
          testId: 'header-case-title',
          label: props.labels[1],
          className: 'col-case-title',
        },
        {
          key: 'debtor-name',
          testId: 'header-debtor-name',
          label: props.labels[2],
          className: 'col-debtor-name',
        },
        {
          key: 'chapter',
          testId: 'header-chapter',
          label: props.labels[3],
          className: 'col-chapter',
        },
        {
          key: 'date-filed',
          testId: 'header-date-filed',
          label: props.labels[4],
          className: 'col-date-filed',
        },
      ]
    : [
        {
          key: 'case-number',
          testId: 'header-case-number',
          label: props.labels[0],
          className: 'col-case-number',
        },
        {
          key: 'case-title',
          testId: 'header-case-title',
          label: props.labels[1],
          className: 'col-case-title',
        },
        {
          key: 'chapter',
          testId: 'header-chapter',
          label: props.labels[2],
          className: 'col-chapter',
        },
        {
          key: 'date-filed',
          testId: 'header-date-filed',
          label: props.labels[3],
          className: 'col-date-filed',
        },
      ];

  const headers = showOpenClosedColumn
    ? [
        ...baseHeaders,
        {
          key: 'open-closed',
          testId: 'header-open-closed',
          label: props.labels[props.labels.length - 1],
          className: 'col-open-closed',
        },
      ]
    : baseHeaders;

  return (
    <CamsTableHeader>
      {headers.map(({ key, testId, label, className }) => (
        <CamsTableHeaderCell key={key} data-testid={testId} className={className}>
          {label}
        </CamsTableHeaderCell>
      ))}
    </CamsTableHeader>
  );
}
