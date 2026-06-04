import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import { TrusteeSummary } from '@common/cams/trustees';
import { Pagination as PaginationModel } from '@common/api/pagination';
import { SearchPredicate, DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_OFFSET } from '@common/api/search';

type BankDetailTrusteesProps = {
  bankName: string;
  bankId: string;
};

export function BankDetailTrustees({ bankName, bankId }: BankDetailTrusteesProps) {
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

    Api2.getBankTrustees(bankId, searchPredicate.limit, searchPredicate.offset)
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
  }, [bankId, searchPredicate]);

  const totalCount = paginationValues.totalCount ?? trustees.length;
  const totalPages = paginationValues.totalPages ?? 1;

  if (isLoading) {
    return <LoadingSpinner caption="Loading..." />;
  }

  if (error) {
    return (
      <Alert
        id="bank-trustees-load-error"
        message={`Failed to load trustees. ${error}`}
        type={UswdsAlertStyle.Error}
        show={true}
      />
    );
  }

  return (
    <div className="bank-detail-trustees" data-testid="bank-detail-trustees">
      <h3 data-testid="bank-trustees-heading">{`Trustees using ${bankName}`}</h3>
      <p className="trustees-count" data-testid="bank-trustees-count">
        {totalCount} {totalCount === 1 ? 'Trustee' : 'Trustees'}
      </p>
      <CamsTable id="bank-trustees-table" aria-label="Trustees using this bank">
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
                <Link to={`/trustees/${trustee.trusteeId}`}>{trustee.name}</Link>
              </CamsTableCell>
            </CamsTableRow>
          ))}
        </CamsTableBody>
      </CamsTable>
      {totalPages > 1 && (
        <Pagination<SearchPredicate>
          paginationValues={paginationValues}
          searchPredicate={searchPredicate}
          retrievePage={setSearchPredicate}
        />
      )}
    </div>
  );
}
