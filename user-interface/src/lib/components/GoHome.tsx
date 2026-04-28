import { LOGIN_SUCCESS_PATH, CASE_SEARCH_PATH } from '@/login/login-library';
import { useEffect, useState, useRef } from 'react';
import { useLDClient } from 'launchdarkly-react-client-sdk';
import useCamsNavigator from '../hooks/UseCamsNavigator';
import useFeatureFlags, { CASE_SEARCH_LANDING_PAGE } from '@/lib/hooks/UseFeatureFlags';
import { getFeatureFlagConfiguration } from '@/configuration/featureFlagConfiguration';

type GoHomeProps = {
  path?: string;
};

/**
 * GoHome
 *
 * FUTURE: This component can be crafted to redirect to new routes from legacy routes that no longer exist in the app.
 *
 * FUTURE: This component could dynamically route to a "home" based on the user's role in CAMS.
 *
 * @param props
 * @returns
 */
export function GoHome(props: GoHomeProps) {
  const navigator = useCamsNavigator();
  const flags = useFeatureFlags();
  const ldClient = useLDClient();
  const [isReady, setIsReady] = useState(false);
  const [hasTimedOut, setHasTimedOut] = useState(false);
  const hasNavigated = useRef(false);
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
            }, 500);
          })
          .catch(() => {
            if (isUnmounted) return;
            // Even if LD fails, we should navigate somewhere
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

  useEffect(() => {
    // Guard against multiple navigation attempts
    if (hasNavigated.current) {
      return;
    }

    if (!isReady) {
      return;
    }

    // If LaunchDarkly is configured, wait for the specific flag to be populated OR timeout
    // After waitForInitialization(), useFlags() should return immediately with either
    // populated flags or an empty object. The timeout handles rare edge cases where
    // React's render cycle delays flag propagation.
    const hasFlagValue = CASE_SEARCH_LANDING_PAGE in flags;

    // Only wait if we expect flags but haven't received them yet AND haven't timed out
    if (ldClient && !hasFlagValue && !hasTimedOut) {
      return;
    }

    // Mark that we're about to navigate
    hasNavigated.current = true;

    // Clear timeout when navigating to prevent setState after navigation
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = undefined;
    }

    if (props.path) {
      navigator.navigateTo(props.path);
      return;
    }

    const destination = flags[CASE_SEARCH_LANDING_PAGE] ? CASE_SEARCH_PATH : LOGIN_SUCCESS_PATH;
    navigator.navigateTo(destination);
  }, [isReady, hasTimedOut, flags, props.path, navigator, ldClient]);

  return <></>;
}
