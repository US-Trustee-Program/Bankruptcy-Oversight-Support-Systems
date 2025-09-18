import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { TrusteeHistory } from '@common/cams/trustees';

export interface TrusteeDetailAuditHistoryProps {
  trusteeId: string;
}

export default function TrusteeDetailAuditHistory(props: TrusteeDetailAuditHistoryProps) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [history, setHistory] = useState<TrusteeHistory[]>([]);

  useEffect(() => {
    Api2.getTrusteeHistory(props.trusteeId)
      .then((results) => {
        setHistory(results.data);
      })
      .catch((_e) => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <div className="trustee-audit-history">
      <h3>Change History</h3>
      {isLoading && <p>Loading...</p>}
      {!isLoading && !history.length && <p>No change history available.</p>}
      {!!history.length &&
        history.map((item, index) => <pre key={index}>${JSON.stringify(item, null, 2)}</pre>)}
    </div>
  );
}
