import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { SearchPredicate } from '@common/api/search';

interface TrusteeCaseListProps {
  trusteeId: string;
}

export default function TrusteeCaseList({ trusteeId }: Readonly<TrusteeCaseListProps>) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<TrusteeCaseListItem[]>([]);
  const [pagination, setPagination] = useState<PaginationModel | undefined>(undefined);
  const [searchPredicate, setSearchPredicate] = useState<SearchPredicate>({
    limit: 25,
    offset: 0,
  });

  useEffect(() => {
    setSearchPredicate({ limit: 25, offset: 0 });
  }, [trusteeId]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    Api2.getTrusteeCases(trusteeId, searchPredicate)
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
  }, [trusteeId, searchPredicate]);

  function handlePagination(predicate: SearchPredicate) {
    setSearchPredicate(predicate);
  }

  return (
    <div data-testid="trustee-case-list" className="right-side-screen-content">
      {isLoading && <LoadingSpinner caption="Loading case list..." />}
      {!isLoading && error && (
        <Alert type={UswdsAlertStyle.Error} show={true}>
          {error}
        </Alert>
      )}
      {!isLoading && !error && cases.length === 0 && (
        <div role="status" aria-live="polite" aria-atomic="true">
          <p>No case appointments found.</p>
        </div>
      )}
      {!isLoading && !error && cases.length > 0 && (
        <>
          <table
            className="usa-table usa-table--borderless"
            data-testid="trustee-case-list-table"
            aria-label="Case list for trustee"
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
                    <CaseNumber caseId={item.caseId} openLinkIn="same-window" />
                    {item.courtDivisionName && `(${item.courtDivisionName})`}
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
            <Pagination<SearchPredicate>
              paginationValues={pagination}
              searchPredicate={searchPredicate}
              retrievePage={handlePagination}
            />
          )}
        </>
      )}
    </div>
  );
}
