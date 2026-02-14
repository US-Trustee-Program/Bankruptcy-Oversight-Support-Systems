import { useState, useRef, useCallback, useEffect } from 'react';
import Api2 from '@/lib/models/api2';
import { SyncedCase } from '@common/cams/cases';

type PollStatus = 'idle' | 'polling' | 'success' | 'timeout';

export function useCaseReloadPolling(initialCase: SyncedCase | null) {
  const [pollStatus, setPollStatus] = useState<PollStatus>('idle');
  const [latestCase, setLatestCase] = useState<SyncedCase | null>(initialCase);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialPollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wasPreviouslySynced = !!initialCase;

  const checkSyncCompleted = useCallback(
    (wasPreviouslySynced: boolean, newCase: SyncedCase | undefined, startTime: Date): boolean => {
      if (wasPreviouslySynced) {
        // Was previously synced - check if timestamp updated
        return !!(newCase && new Date(newCase.updatedOn) > startTime);
      }
      // Was "Not yet synced" - any result is success
      return !!newCase;
    },
    [],
  );

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

  const startPolling = useCallback(
    (caseId: string, startTime: Date) => {
      let pollCount = 0;
      const maxPolls = 24; // 2 minutes (5s initial delay + 23 polls * 5s)
      const pollInterval = 5000;
      const initialDelay = 5000;

      // Clear any existing polling (safety)
      stopPolling();
      setPollStatus('polling');

      // Initial 5-second delay before first poll
      initialPollTimeoutRef.current = setTimeout(() => {
        // Poll every 5 seconds
        pollIntervalRef.current = setInterval(async () => {
          pollCount++;

          try {
            const searchResponse = await Api2.searchCases({
              caseIds: [caseId],
              limit: 1,
              offset: 0,
            });

            const newCosmosCase = searchResponse?.data?.[0];

            // Check for success
            const syncCompleted = checkSyncCompleted(wasPreviouslySynced, newCosmosCase, startTime);

            if (syncCompleted) {
              // Success!
              stopPolling();
              setPollStatus('success');
              setLatestCase(newCosmosCase ?? null);
              return;
            }

            // Check timeout
            if (pollCount >= maxPolls) {
              stopPolling();
              setPollStatus('timeout');
              return;
            }
          } catch {
            // Polling API error - continue polling on transient errors
          }
        }, pollInterval);
      }, initialDelay);
    },
    [checkSyncCompleted, stopPolling, wasPreviouslySynced],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    pollStatus,
    latestCase,
    startPolling,
    stopPolling,
  };
}
