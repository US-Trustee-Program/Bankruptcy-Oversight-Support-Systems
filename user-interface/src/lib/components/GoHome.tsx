import { LOGIN_SUCCESS_PATH, CASE_SEARCH_PATH } from '@/login/login-library';
import { useEffect } from 'react';
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

  useEffect(() => {
    if (props.path) {
      navigator.navigateTo(props.path);
      return;
    }

    const destination = flags[CASE_SEARCH_LANDING_PAGE] ? CASE_SEARCH_PATH : LOGIN_SUCCESS_PATH;

    navigator.navigateTo(destination);
  }, []);
  return <></>;
}
