import { useEffect, useState } from 'react';
import { Trustee } from '@common/cams/trustees';
import Api2 from '@/lib/models/api2';

/**
 * Hook to fetch trustee data by trusteeId.
 * Returns the trustee and loading state.
 */
export function useTrustee(trusteeId?: string | null) {
  const [trustee, setTrustee] = useState<Trustee | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trusteeId) {
      return;
    }

    let isCurrent = true;
    setTrustee(null);
    setLoading(true);

    Api2.getTrustee(trusteeId)
      .then((response) => {
        if (!isCurrent) return;
        setTrustee(response.data);
      })
      .catch(() => {
        if (!isCurrent) return;
        setTrustee(null);
      })
      .finally(() => {
        if (!isCurrent) return;
        setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [trusteeId]);

  return { trustee, loading };
}
