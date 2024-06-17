import { createContext, PropsWithChildren, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CamsSession,
  CamsUser,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  LoginProvider,
  AUTHENTICATION_PATHS,
  LOGIN_SUCCESS_PATH,
} from './login-library';

export const SessionContext = createContext<CamsSession>({
  apiToken: null,
  provider: null,
  user: null,
});

export type SessionProps = PropsWithChildren & {
  apiToken: string;
  provider: LoginProvider;
  user: CamsUser;
};

export function Session(props: SessionProps) {
  const { apiToken, provider, user } = props;
  const navigate = useNavigate();
  const location = useLocation();

  const session: CamsSession = { apiToken, provider, user };

  if (window.localStorage) {
    window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
  }

  useEffect(() => {
    if (AUTHENTICATION_PATHS.includes(location.pathname)) navigate(LOGIN_SUCCESS_PATH);
  }, []);

  return <SessionContext.Provider value={session}>{props.children}</SessionContext.Provider>;
}
