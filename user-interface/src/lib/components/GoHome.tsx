import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export type GoHomeProps = {
  path?: string;
};

/**
 * GoHome
 *
 * FUTURE: This component can be crafted to redirect to legacy routes that no longer exist in the app.
 *
 * FUTURE: This component dynamically route based on the user's role in CAMS.
 *
 * @param props
 * @returns
 */
export function GoHome(props: GoHomeProps) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(props.path ?? '/my-cases');
  }, []);
  return <></>;
}
