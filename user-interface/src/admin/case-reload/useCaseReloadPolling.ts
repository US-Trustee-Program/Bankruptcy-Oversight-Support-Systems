import { useState, useRef, useCallback, useEffect } from 'react';
import Api2 from '@/lib/models/api2';
import { SyncedCase } from '@common/cams/cases';
import { PollStatus } from './case-reload-types';

export function useCaseReloadPolling() {
  const [pollStatus, setPollStatus] = useState<PollStatus>('idle');
  const [cosmosCase, setCosmosCase] = useState<SyncedCase | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wasPreviouslySyncedRef = useRef(false);
  const previousUpdatedOnRef = useRef('1970-01-01T00:00:00.000Z');

  const checkSyncCompleted = useCallback((newCase: SyncedCase | undefined): boolean => {
    if (wasPreviouslySyncedRef.current) {
      // Was previously synced - check if updatedOn changed compared to previous value
      return !!(newCase && newCase.updatedOn !== previousUpdatedOnRef.current);
    }
    // Was "Not yet synced" - any result is success
    return !!newCase;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (initialPollTimeoutRef.current) {
      clearTimeout(initialPollTimeoutRef.current);
      initialPollTimeoutRef.current = null;
    }
    setPollStatus('idle');
  }, []);

  const pollCountRef = useRef(0);

  const runPoll = useCallback(
    async (caseId: string, maxPolls: number) => {
      pollCountRef.current += 1;

      try {
        const searchResponse = await Api2.searchCases({
          caseIds: [caseId],
          limit: 1,
          offset: 0,
        });

        const newCosmosCase = searchResponse?.data?.[0];
        const syncCompleted = checkSyncCompleted(newCosmosCase);

        if (syncCompleted) {
          stopPolling();
          setPollStatus('success');
          setCosmosCase(newCosmosCase ?? null);
          return;
        }

        if (pollCountRef.current >= maxPolls) {
          stopPolling();
          setPollStatus('timeout');
        }
      } catch {
        // continue polling on transient errors
      }
    },
    [checkSyncCompleted, stopPolling],
  );

  const startPolling = useCallback(
    (caseId: string) => {
      const maxPolls = 24; // 2 minutes (5s initial delay + 23 polls * 5s)
      const pollInterval = 5000;
      const initialDelay = 5000;

      // Clear any existing polling (safety)
      stopPolling();
      setPollStatus('polling');
      pollCountRef.current = 0;

      // Initial 5-second delay before first poll
      initialPollTimeoutRef.current = setTimeout(() => {
        pollIntervalRef.current = setInterval(() => {
          runPoll(caseId, maxPolls);
        }, pollInterval);
      }, initialDelay);
    },
    [runPoll, stopPolling],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const setInitialCase = useCallback((initialCase: SyncedCase | null) => {
    setCosmosCase(initialCase);
    wasPreviouslySyncedRef.current = !!initialCase;
    previousUpdatedOnRef.current = initialCase?.updatedOn ?? '1970-01-01T00:00:00.000Z';
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setCosmosCase(null);
    wasPreviouslySyncedRef.current = false;
    previousUpdatedOnRef.current = '1970-01-01T00:00:00.000Z';
  }, [stopPolling]);

  return {
    pollStatus,
    cosmosCase,
    startPolling,
    stopPolling,
    setInitialCase,
    reset,
  };
}
