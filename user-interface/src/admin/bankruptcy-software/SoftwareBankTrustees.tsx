import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Api2 from '@/lib/models/api2';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { NewTabLink } from '@/lib/components/cams/NewTabLink/NewTabLink';
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
import DocumentTitle from '@/lib/components/cams/DocumentTitle/DocumentTitle';
import { BackLink } from '@/lib/components/cams/BackLink/BackLink';

export function SoftwareBankTrustees() {
  const { softwareId, bankId } = useParams();
  const [softwareName, setSoftwareName] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
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
    if (!softwareId || !bankId) return;

    let isCancelled = false;

    Promise.all([Api2.getSoftwareName(softwareId), Api2.getBank(bankId)])
      .then(([softwareResponse, bankResponse]) => {
        if (isCancelled) return;
        setSoftwareName(softwareResponse.data.name);
        setBankName(bankResponse.data.name);
      })
      .catch(() => {
        // Names are supplemental — don't block rendering
      });

    return () => {
      isCancelled = true;
    };
  }, [softwareId, bankId]);

  useEffect(() => {
    if (!softwareId || !bankId) return;

    let isCancelled = false;
    setIsLoading(true);
    setError(null);

    Api2.getSoftwareBankTrustees(softwareId, bankId, searchPredicate.limit, searchPredicate.offset)
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
  }, [softwareId, bankId, searchPredicate]);

  const totalCount = paginationValues.totalCount ?? trustees.length;
  const totalPages = paginationValues.totalPages ?? 1;

  if (isLoading) {
    return <LoadingSpinner caption="Loading..." />;
  }

  if (error) {
    return (
      <Alert
        id="software-bank-trustees-load-error"
        message={`Failed to load trustees. ${error}`}
        type={UswdsAlertStyle.Error}
        show={true}
      />
    );
  }

  return (
    <div className="software-bank-trustees" data-testid="software-bank-trustees">
      <DocumentTitle name={`Trustees Using ${bankName}`} />
      <BackLink
        to={`/admin/bankruptcy-software/${softwareId}/overview`}
        label={`Back to ${softwareName || 'Software'}`}
        title="Back to software overview"
        testId="back-to-software-link"
      />
      <h1>{softwareName}</h1>
      <h2>Trustees Using {bankName}</h2>
      <p className="trustees-count" data-testid="software-bank-trustees-count">
        {totalCount} {totalCount === 1 ? 'Trustee' : 'Trustees'}
      </p>
      <CamsTable id="software-bank-trustees-table" aria-label={`Trustees using ${bankName}`}>
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
          retrievePage={setSearchPredicate}
        />
      )}
    </div>
  );
}
