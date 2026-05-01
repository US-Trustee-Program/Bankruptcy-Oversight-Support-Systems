import { useState, useEffect } from 'react';
import Api2 from '@/lib/models/api2';
import { CourtDivisionDetails } from '@common/cams/courts';

// Shared cache for courts data to avoid redundant API calls
let courtsCache: CourtDivisionDetails[] | null = null;
let courtsPromise: Promise<CourtDivisionDetails[]> | null = null;

/**
 * Shared hook for fetching courts data with caching.
 *
 * Multiple components can call this hook simultaneously without triggering
 * redundant API calls. The first call initiates the fetch, subsequent calls
 * reuse the same promise until the data is cached.
 *
 * @returns {courts, loading, error}
 */
export default function useCourts() {
  const [courts, setCourts] = useState<CourtDivisionDetails[]>(courtsCache || []);
  const [loading, setLoading] = useState<boolean>(!courtsCache);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // If we already have cached data, use it immediately
    if (courtsCache) {
      setCourts(courtsCache);
      setLoading(false);
      return;
    }

    // If a fetch is already in progress, wait for it
    if (courtsPromise) {
      courtsPromise
        .then((data) => {
          setCourts(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err);
          setLoading(false);
        });
      return;
    }

    // Start a new fetch
    setLoading(true);
    courtsPromise = Api2.getCourts()
      .then((response) => {
        courtsCache = response.data;
        return response.data;
      })
      .catch((err) => {
        courtsPromise = null; // Reset on error so retry is possible
        throw err;
      });

    courtsPromise
      .then((data) => {
        setCourts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { courts, loading, error };
}
