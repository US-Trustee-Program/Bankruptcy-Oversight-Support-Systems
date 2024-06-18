import { PropsWithChildren, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LOGIN_PATHS, LOGIN_SUCCESS_PATH } from './login-library';
import { LocalStorage } from '@/lib/utils/local-storage';
import { CamsSession } from '@/lib/type-declarations/session';

export type SessionProps = CamsSession & PropsWithChildren;

export function Session(props: SessionProps) {
  const { apiToken, provider, user } = props;
  const navigate = useNavigate();
  const location = useLocation();

  const session: CamsSession = { apiToken, provider, user };

  LocalStorage.setSession(session);

  useEffect(() => {
    if (LOGIN_PATHS.includes(location.pathname)) navigate(LOGIN_SUCCESS_PATH);
  }, []);

  return <>{props.children}</>;
}
