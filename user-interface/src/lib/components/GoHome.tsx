import { LOGIN_SUCCESS_PATH, CASE_SEARCH_PATH } from '@/login/login-library';
import { useEffect, useState } from 'react';
import { useLDClient } from 'launchdarkly-react-client-sdk';
import useCamsNavigator from '../hooks/UseCamsNavigator';
import useFeatureFlags, { CASE_SEARCH_LANDING_PAGE } from '@/lib/hooks/UseFeatureFlags';

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

  // Wait for LaunchDarkly to be ready
  useEffect(() => {
    if (ldClient) {
      ldClient.waitForInitialization().then(() => {
        setIsReady(true);
      }).catch(() => {
        // Even if LD fails, we should navigate somewhere
        setIsReady(true);
      });
    }
    // Don't set isReady if ldClient is undefined - wait for it to be available
  }, [ldClient]);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (props.path) {
      navigator.navigateTo(props.path);
      return;
    }

    const destination = flags[CASE_SEARCH_LANDING_PAGE] ? CASE_SEARCH_PATH : LOGIN_SUCCESS_PATH;
    navigator.navigateTo(destination);
  }, [isReady, flags, props.path, navigator]);

  return <></>;
}
