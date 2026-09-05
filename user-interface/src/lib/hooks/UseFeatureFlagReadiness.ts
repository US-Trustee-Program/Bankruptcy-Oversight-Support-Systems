import { useEffect, useRef, useState } from 'react';
import { useLDClient } from 'launchdarkly-react-client-sdk';
import { getFeatureFlagConfiguration } from '@/configuration/featureFlagConfiguration';

const FLAG_POPULATION_TIMEOUT_MS = 500;

type FeatureFlagReadiness = {
  isReady: boolean;
  hasTimedOut: boolean;
};

export default function useFeatureFlagReadiness(): FeatureFlagReadiness {
  const ldClient = useLDClient();
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Wait for LaunchDarkly to be ready
  useEffect(() => {
    const config = getFeatureFlagConfiguration();
    let isUnmounted = false;

    // If LaunchDarkly is configured, wait for the client to be available
    if (config.useExternalProvider) {
      if (ldClient) {
        ldClient
          .waitForInitialization()
          .then(() => {
            if (isUnmounted) return;
            setIsReady(true);
            // Set a timeout: if flags don't arrive via useFlags() within 500ms, proceed anyway
            // This handles cases where LD initializes but returns no flags for the user
            timeoutIdRef.current = setTimeout(() => {
              setHasTimedOut(true);
            }, FLAG_POPULATION_TIMEOUT_MS);
          })
          .catch(() => {
            if (isUnmounted) return;
            // Even if LD fails, we should proceed
            setIsReady(true);
            setHasTimedOut(true);
          });
      }
      // If ldClient is undefined, wait for it to become available (don't set isReady)
    } else {
      // If LaunchDarkly is not configured, proceed immediately with test flags
      setIsReady(true);
      setHasTimedOut(true);
    }

    return () => {
      isUnmounted = true;
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [ldClient]);

  return { isReady, hasTimedOut };
}
