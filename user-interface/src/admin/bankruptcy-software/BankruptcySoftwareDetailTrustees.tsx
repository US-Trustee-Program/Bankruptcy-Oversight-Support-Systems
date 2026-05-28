import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { Pagination } from '@/lib/components/uswds/Pagination';
import {
  CamsTable,
  CamsTableBody,
  CamsTableHeader,
  CamsTableHeaderCell,
  CamsTableRow,
  CamsTableCell,
} from '@/lib/components/cams/CamsTable';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
import { TrusteeSummary } from '@common/cams/trustees';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { SearchPredicate, DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';

type BankruptcySoftwareDetailTrusteesProps = {
  softwareName: string;
  softwareId: string;
};

export function BankruptcySoftwareDetailTrustees({
  softwareName,
  softwareId,
}: BankruptcySoftwareDetailTrusteesProps) {
  const [trustees, setTrustees] = useState<TrusteeSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginationValues, setPaginationValues] = useState<PaginationModel>({
    count: 0,
    limit: DEFAULT_SEARCH_LIMIT,
    currentPage: 1,
  });
  const [searchPredicate, setSearchPredicate] = useState<SearchPredicate>({
    limit: DEFAULT_SEARCH_LIMIT,
    offset: DEFAULT_SEARCH_OFFSET,
  });

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    Api2.getSoftwareTrustees(softwareId, searchPredicate.limit, searchPredicate.offset)
      .then((response) => {
        if (isCancelled) return;
        setTrustees(response.data);
        if (response.pagination) {
          setPaginationValues(response.pagination);
        }
      })
      .catch((err: Error) => {
        if (isCancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (isCancelled) return;
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [softwareId, searchPredicate]);

  function retrievePage(predicate: SearchPredicate) {
    setSearchPredicate(predicate);
  }

  const totalCount = paginationValues.totalCount ?? trustees.length;
  const totalPages = paginationValues.totalPages ?? 1;

  if (isLoading) {
    return <LoadingSpinner caption="Loading..." />;
  }

  if (error) {
    return (
      <Alert
        id="trustees-load-error"
        message={`Failed to load trustees. ${error}`}
        type={UswdsAlertStyle.Error}
        show={true}
      />
    );
  }

  return (
    <div className="software-detail-trustees" data-testid="software-detail-trustees">
      <h3>Trustees using {softwareName}</h3>
      <p className="trustees-count">
        {totalCount} {totalCount === 1 ? 'Trustee' : 'Trustees'}
      </p>
      <CamsTable id="software-trustees-table" aria-label="Trustees using this software">
        <CamsTableHeader>
          <CamsTableHeaderCell>Trustee Name</CamsTableHeaderCell>
        </CamsTableHeader>
        <CamsTableBody>
          {trustees.length === 0 && (
            <CamsTableRow>
              <CamsTableCell>
                <span data-testid="no-trustees-message">No trustees found.</span>
              </CamsTableCell>
            </CamsTableRow>
          )}
          {trustees.map((trustee) => (
            <CamsTableRow key={trustee.id}>
              <CamsTableCell>
                <NewTabLink to={`/trustees/${trustee.trusteeId}`} label={trustee.name} />
              </CamsTableCell>
            </CamsTableRow>
          ))}
        </CamsTableBody>
      </CamsTable>
      {totalPages > 1 && (
        <Pagination<SearchPredicate>
          paginationValues={paginationValues}
          searchPredicate={searchPredicate}
          retrievePage={retrievePage}
        />
      )}
    </div>
  );
}
