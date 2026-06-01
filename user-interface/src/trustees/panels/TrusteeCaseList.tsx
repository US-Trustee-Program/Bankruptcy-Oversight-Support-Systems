import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { TrusteeCaseListItem } from '@common/cams/trustee-appointments';
import { LoadingSpinner } from '@/lib/components/LoadingSpinner';
import Alert, { UswdsAlertStyle } from '@/lib/components/uswds/Alert';
import { CaseNumber } from '@/lib/components/CaseNumber';
import { formatDate } from '@/lib/utils/datetime';

interface TrusteeCaseListProps {
  trusteeId: string;
}

export default function TrusteeCaseList({ trusteeId }: Readonly<TrusteeCaseListProps>) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cases, setCases] = useState<TrusteeCaseListItem[]>([]);

  useEffect(() => {
    Api2.getTrusteeCases(trusteeId)
      .then((response) => {
        setCases(response.data);
      })
      .catch(() => {
        setError('Could not load case list.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId]);

  return (
    <div data-testid="trustee-case-list" className="right-side-screen-content">
      {isLoading && <LoadingSpinner />}
      {!isLoading && error && (
        <Alert type={UswdsAlertStyle.Error} show={true}>
          {error}
        </Alert>
      )}
      {!isLoading && !error && cases.length === 0 && <p>No case appointments found.</p>}
      {!isLoading && !error && cases.length > 0 && (
        <table className="usa-table usa-table--borderless" data-testid="trustee-case-list-table">
          <thead>
            <tr>
              <th scope="col">Case Number</th>
              <th scope="col">Chapter</th>
              <th scope="col">Filed Date</th>
              <th scope="col">Appointed Date</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((item) => (
              <tr key={item.caseId}>
                <td>
                  <CaseNumber caseId={item.caseId} openLinkIn="same-window" />
                </td>
                <td>{item.chapter}</td>
                <td>{formatDate(item.dateFiled)}</td>
                <td>{formatDate(item.appointedDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
