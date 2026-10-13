import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { CaseTrusteeAppointmentHistoryItem } from '@common/cams/trustee-appointments';

export function useCaseAppointment(caseId: string | undefined) {
  const [appointedDate, setAppointedDate] = useState<string | null>(null);
  const [trusteeId, setTrusteeId] = useState<string | null>(null);
  const [history, setHistory] = useState<CaseTrusteeAppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!caseId) return;

    let isCurrent = true;
    setAppointedDate(null);
    setTrusteeId(null);
    setHistory([]);
    setLoading(true);

    Api2.getCaseTrusteeAppointment(caseId)
      .then((response) => {
        if (!isCurrent) return;
        setTrusteeId(response.data?.current?.trusteeId ?? null);
        setAppointedDate(response.data?.current?.appointedDate ?? null);
        setHistory(response.data?.history ?? []);
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        console.error('Unexpected error fetching case trustee appointment', error);
        setAppointedDate(null);
        setTrusteeId(null);
        setHistory([]);
      })
      .finally(() => {
        if (!isCurrent) return;
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [caseId]);

  return { appointedDate, trusteeId, history, loading };
}
