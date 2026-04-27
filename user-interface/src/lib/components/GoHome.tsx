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

  // Wait for LaunchDarkly to be ready
  useEffect(() => {
    const config = getFeatureFlagConfiguration();

    // If LaunchDarkly is configured, wait for the client to be available
    if (config.useExternalProvider) {
      if (ldClient) {
        ldClient
          .waitForInitialization()
          .then(() => {
            setIsReady(true);
            // Set a timeout: if flags don't arrive via useFlags() within 500ms, proceed anyway
            // This handles cases where LD initializes but returns no flags for the user
            const timeoutId = setTimeout(() => {
              setHasTimedOut(true);
            }, 500);

            // Clean up timeout on unmount
            return () => clearTimeout(timeoutId);
          })
          .catch(() => {
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
  }, [ldClient]);

  useEffect(() => {
    // Guard against multiple navigation attempts
    if (hasNavigated.current) {
      return;
    }

    if (!isReady) {
      return;
    }

    // If LaunchDarkly is configured, wait for flags to be populated OR timeout
    // The flags object starts empty and gets populated after initialization
    const hasFlagValue = CASE_SEARCH_LANDING_PAGE in flags;
    const hasAnyFlags = Object.keys(flags).length > 0;

    // If LD client exists but flags aren't loaded yet and we haven't timed out, wait
    if (ldClient && !hasFlagValue && !hasAnyFlags && !hasTimedOut) {
      return;
    }

    // Mark that we're about to navigate
    hasNavigated.current = true;

    if (props.path) {
      navigator.navigateTo(props.path);
      return;
    }

    const destination = flags[CASE_SEARCH_LANDING_PAGE] ? CASE_SEARCH_PATH : LOGIN_SUCCESS_PATH;
    navigator.navigateTo(destination);
  }, [isReady, hasTimedOut, flags, props.path, navigator, ldClient]);

  return <></>;
}
