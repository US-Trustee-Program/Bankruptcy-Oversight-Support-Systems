import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';

export function useCaseAppointment(caseId: string | undefined) {
  const [appointedDate, setAppointedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!caseId) return;

    let isCurrent = true;
    setAppointedDate(null);
    setLoading(true);

    Api2.getCaseTrusteeAppointment(caseId)
      .then((response) => {
        if (!isCurrent) return;
        setAppointedDate(response.data?.appointedDate ?? null);
      })
      .catch(() => {
        if (!isCurrent) return;
        setAppointedDate(null);
      })
      .finally(() => {
        if (!isCurrent) return;
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [caseId]);

  return { appointedDate, loading };
}
