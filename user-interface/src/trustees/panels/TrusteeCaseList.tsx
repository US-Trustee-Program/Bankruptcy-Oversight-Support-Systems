import './TrusteeCaseList.scss';
import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { Pagination as PaginationModel } from '@common/api/pagination';
import {
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_OFFSET,
  TrusteeCasesSearchPredicate,
} from '@common/api/search';
import TrusteeCaseListFilter from './filters/TrusteeCaseListFilter';
import { TrusteeCaseListFilterValue } from './filters/trusteeCaseListFilter.types';

type PaginationPredicate = { limit: number; offset: number };

function buildSearchPredicate(
  paginationPredicate: PaginationPredicate,
  filterPredicate: TrusteeCaseListFilterValue,
): TrusteeCasesSearchPredicate {
  return {
    ...paginationPredicate,
    caseStatus: filterPredicate.caseStatus,
    chapters: filterPredicate.chapters.length ? filterPredicate.chapters : undefined,
    filedDateFrom: filterPredicate.filedDateFrom,
    filedDateTo: filterPredicate.filedDateTo,
  };
}

interface TrusteeCaseListProps {
  trusteeId: string;
  filterPredicate: TrusteeCaseListFilterValue;
  onFilterChange: (filter: TrusteeCaseListFilterValue) => void;
}

export default function TrusteeCaseList({
  trusteeId,
  filterPredicate,
  onFilterChange,
}: Readonly<TrusteeCaseListProps>) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<TrusteeCaseListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationModel | undefined>(undefined);
  const [paginationPredicate, setPaginationPredicate] = useState<PaginationPredicate>({
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
  });
  // Reset to page 1 when filters change
  useEffect(() => {
    setPaginationPredicate({ limit: DEFAULT_SEARCH_LIMIT, offset: DEFAULT_SEARCH_OFFSET });
  }, [filterPredicate]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    Api2.getTrusteeCases(trusteeId, buildSearchPredicate(paginationPredicate, filterPredicate))
      .then((response) => {
        setCases(response.data);
        setPagination(response.pagination);
      })
      .catch(() => {
        setError('Could not load case list.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, paginationPredicate, filterPredicate]);

  function handlePaginationChange(predicate: PaginationPredicate) {
    setPaginationPredicate({ limit: predicate.limit, offset: predicate.offset });
  }

  const totalCount = pagination?.totalCount ?? 0;

  return (
    <div data-testid="trustee-case-list" className="right-side-screen-content">
      <h3 className="trustee-case-list-heading">Case List</h3>
      <TrusteeCaseListFilter onFilterChange={onFilterChange} initialValue={filterPredicate} />
      {isLoading && <LoadingSpinner caption="Loading case list..." />}
      {!isLoading && error && (
        <Alert type={UswdsAlertStyle.Error} show={true}>
          {error}
        </Alert>
      )}
      {!isLoading && !error && cases.length === 0 && (
        <Alert
          type={UswdsAlertStyle.Info}
          title={'No case appointments found'}
          message={'Consider adjusting your filters.'}
          show={true}
          slim={false}
          inline={true}
          role="status"
          className="case-list-alert"
        />
      )}
      {!isLoading && !error && cases.length > 0 && (
        <>
          <p className="trustee-case-list-count" aria-live="polite" aria-atomic="true">
            {totalCount} {totalCount === 1 ? 'Case' : 'Cases'}
          </p>
          <table
            className="usa-table usa-table--borderless"
            data-testid="trustee-case-list-table"
            aria-label="Case list for trustee"
            aria-live="off"
            aria-atomic="false"
          >
            <thead>
              <tr>
                <th scope="col">Case Number (Division)</th>
                <th scope="col">Case Title</th>
                <th scope="col">Chapter</th>
                <th scope="col">Case Filed</th>
                <th scope="col">Appt. Date</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.caseId}>
                  <td>
                    <CaseNumber caseId={item.caseId} openLinkIn="new-window" />
                    {item.courtDivisionName && ` (${item.courtDivisionName})`}
                  </td>
                  <td>{item.caseTitle}</td>
                  <td>{item.chapter}</td>
                  <td>{formatDate(item.dateFiled)}</td>
                  <td>{item.appointedDate ? formatDate(item.appointedDate) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && pagination.totalPages && pagination.totalPages > 1 && (
            <Pagination<PaginationPredicate>
              paginationValues={pagination}
              searchPredicate={paginationPredicate}
              retrievePage={handlePaginationChange}
            />
          )}
        </>
      )}
    </div>
  );
}
