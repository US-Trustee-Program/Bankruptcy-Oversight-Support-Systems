import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';

export function useCaseAppointment(caseId: string | undefined) {
  const [appointedDate, setAppointedDate] = useState<string | null>(null);
  const [trusteeId, setTrusteeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!caseId) return;

    let isCurrent = true;
    setAppointedDate(null);
    setTrusteeId(null);
    setLoading(true);

    Api2.getCaseTrusteeAppointment(caseId)
      .then((response) => {
        if (!isCurrent) return;
        setAppointedDate(response.data?.appointedDate ?? null);
        setTrusteeId(response.data?.trusteeId ?? null);
      })
      .catch(() => {
        if (!isCurrent) return;
        setAppointedDate(null);
        setTrusteeId(null);
      })
      .finally(() => {
        if (!isCurrent) return;
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [caseId]);

  return { appointedDate, trusteeId, loading };
}
