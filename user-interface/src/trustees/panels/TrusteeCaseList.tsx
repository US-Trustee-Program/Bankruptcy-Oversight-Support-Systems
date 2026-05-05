import './TrusteeCaseList.scss';
import { Link } from 'react-router-dom';
import { getCaseNumber } from '@common/cams/cases';
import { formatDate } from '@/lib/utils/datetime';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import { Pagination } from '@/lib/components/uswds/Pagination';
import { useTrusteeCaseList } from './useTrusteeCaseList';

interface TrusteeCaseListProps {
  trusteeId: string;
}

export default function TrusteeCaseList({ trusteeId }: Readonly<TrusteeCaseListProps>) {
  const { cases, pagination, isLoading, predicate, fetchPage } = useTrusteeCaseList(trusteeId);

  if (isLoading) {
    return <LoadingSpinner caption="Loading cases..." />;
  }

  return (
    <div className="trustee-case-list">
      {cases.length === 0 ? (
        <p>No cases found.</p>
      ) : (
        <>
          <table className="usa-table usa-table--borderless" data-testid="trustee-case-list-table">
            <thead>
              <tr>
                <th scope="col">Case Number</th>
                <th scope="col">Case Title</th>
                <th scope="col">Chapter</th>
                <th scope="col">Date Filed</th>
                <th scope="col">Closed Date</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((item) => (
                <tr key={item.caseId} data-testid={`case-row-${item.caseId}`}>
                  <td>
                    <Link to={`/case-detail/${item.caseId}`}>{getCaseNumber(item.caseId)}</Link>
                  </td>
                  <td>{item.caseTitle}</td>
                  <td>{item.chapter}</td>
                  <td>{formatDate(item.dateFiled)}</td>
                  <td>{item.closedDate ? formatDate(item.closedDate) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagination && (pagination.totalPages ?? 0) > 1 && (
            <Pagination
              paginationValues={pagination}
              searchPredicate={predicate}
              retrievePage={(p) => fetchPage(p.offset ?? 0)}
            />
          )}
        </>
      )}
    </div>
  );
}
