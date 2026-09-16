import { useEffect, useState } from 'react';
import Api2 from '@/lib/models/api2';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';

export interface UseUpcomingKeyDates {
  data: TrusteeUpcomingKeyDates | null;
  isLoading: boolean;
  error: boolean;
}

export function useUpcomingKeyDates(
  trusteeId: string,
  appointmentId: string,
  enabled: boolean,
): UseUpcomingKeyDates {
  const [data, setData] = useState<TrusteeUpcomingKeyDates | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    setIsLoading(true);
    setError(false);
    Api2.getUpcomingKeyDates(trusteeId, appointmentId)
      .then((response) => {
        setData(response.data);
      })
      .catch((err) => {
        console.error('Could not load upcoming key dates', err);
        setError(true);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [trusteeId, appointmentId, enabled]);

  return { data, isLoading, error };
}
