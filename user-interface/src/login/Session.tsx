import { PropsWithChildren, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LOGIN_PATHS, LOGIN_SUCCESS_PATH } from './login-library';
import { LocalStorage } from '@/lib/utils/local-storage';
import { CamsSession } from '@common/cams/session';

export type SessionProps = CamsSession & PropsWithChildren;

export function Session(props: SessionProps) {
  const { accessToken, provider, user, expires, validatedClaims } = props;
  const navigate = useNavigate();
  const location = useLocation();

  const session: CamsSession = { accessToken, provider, user, expires, validatedClaims };

  LocalStorage.setSession(session);

  useEffect(() => {
    if (LOGIN_PATHS.includes(location.pathname)) navigate(LOGIN_SUCCESS_PATH);
  }, []);

  return <>{props.children}</>;
}
