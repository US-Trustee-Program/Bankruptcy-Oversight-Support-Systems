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
import {
  CamsTable,
  CamsTableBody,
  CamsTableCell,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableRow,
} from '@/lib/components/cams/CamsTable';
import { formatCaseStatus } from './filters/trusteeCaseListFilter.types';

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
    ...(filterPredicate.divisionCodes?.length
      ? { divisionCodes: filterPredicate.divisionCodes }
      : {}),
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
          title="No case appointments found"
          message="Consider adjusting your filters."
          show={true}
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
          <CamsTable
            className="trustee-case-list-table"
            data-testid="trustee-case-list-table"
            aria-label="Case list for trustee"
          >
            <CamsTableHeader>
              <CamsTableHeaderCell className="col-case-number">
                Case Number (Division)
              </CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-case-title">Case Title</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-chapter">Chapter</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-date-filed">Case Filed</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-appt-date">Appt. Date</CamsTableHeaderCell>
              <CamsTableHeaderCell className="col-case-status">Case Status</CamsTableHeaderCell>
            </CamsTableHeader>
            <CamsTableBody>
              {cases.map((item) => (
                <CamsTableRow key={item.caseId}>
                  <CamsTableCell className="col-case-number" data-cell="Case Number (Division)">
                    <CaseNumber caseId={item.caseId} openLinkIn="new-window" />
                    {item.courtDivisionName && ` (${item.courtDivisionName})`}
                  </CamsTableCell>
                  <CamsTableCell className="col-case-title" data-cell="Case Title">
                    {item.caseTitle}
                  </CamsTableCell>
                  <CamsTableCell className="col-chapter" data-cell="Chapter">
                    {item.chapter}
                  </CamsTableCell>
                  <CamsTableCell className="col-date-filed" data-cell="Case Filed">
                    {formatDate(item.dateFiled)}
                  </CamsTableCell>
                  <CamsTableCell className="col-appt-date" data-cell="Appt. Date">
                    {item.appointedDate ? formatDate(item.appointedDate) : ''}
                  </CamsTableCell>
                  <CamsTableCell className="col-case-status" data-cell="Case Status">
                    {formatCaseStatus(item.caseStatus)}
                  </CamsTableCell>
                </CamsTableRow>
              ))}
            </CamsTableBody>
          </CamsTable>
          {pagination && pagination.totalPages && pagination.totalPages > 1 && (
            <div aria-live="off" aria-atomic="false">
              <Pagination<PaginationPredicate>
                paginationValues={pagination}
                searchPredicate={paginationPredicate}
                retrievePage={handlePaginationChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
