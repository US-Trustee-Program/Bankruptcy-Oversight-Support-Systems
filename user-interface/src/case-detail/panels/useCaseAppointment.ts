import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { CamsHttpError } from '@/lib/models/api';
import {
  CaseTrusteeAppointmentHistory,
  CaseTrusteeAppointmentHistoryItem,
} from '@common/cams/trustee-appointments';

function isCaseTrusteeAppointmentHistory(data: unknown): data is CaseTrusteeAppointmentHistory {
  return !!data && typeof data === 'object' && 'history' in data;
}

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
        if (isCaseTrusteeAppointmentHistory(response.data)) {
          setTrusteeId(response.data.current?.trusteeId ?? null);
          setAppointedDate(response.data.current?.appointedDate ?? null);
          setHistory(response.data.history);
        } else {
          setTrusteeId(response.data?.trusteeId ?? null);
          setAppointedDate(response.data?.appointedDate ?? null);
          setHistory([]);
        }
      })
      .catch((error: unknown) => {
        if (!isCurrent) return;
        if (!(error instanceof CamsHttpError && error.status === 404)) {
          console.error('Unexpected error fetching case trustee appointment', error);
        }
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
