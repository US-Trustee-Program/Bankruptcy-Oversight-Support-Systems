import { LOGIN_SUCCESS_PATH } from '@/login/login-library';
import { useEffect } from 'react';
import useCamsNavigator from '../hooks/UseCamsNavigator';

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
  useEffect(() => {
    navigator.navigateTo(props.path ?? LOGIN_SUCCESS_PATH);
  }, []);
  return <></>;
}
