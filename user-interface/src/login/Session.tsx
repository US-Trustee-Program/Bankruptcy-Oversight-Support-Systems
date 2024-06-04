import { createContext, PropsWithChildren, useEffect } from 'react';
import {
  CamsSession,
  CamsUser,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  LoginProvider,
  LOGIN_PATH,
  LOGOUT_PATH,
} from './login-helpers';
import { useLocation, useNavigate } from 'react-router-dom';

export type SessionContextType = {
  user: CamsUser | null;
};

export const SessionContext = createContext<SessionContextType>({
  user: null,
});

export type SessionProps = PropsWithChildren & {
  provider: LoginProvider;
  user: CamsUser;
};

export function Session(props: SessionProps) {
  const { provider, user } = props;
  const navigate = useNavigate();
  const location = useLocation();

  const session: CamsSession = { provider, user };
  if (window.localStorage) {
    window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
  }

  useEffect(() => {
    if ([LOGIN_PATH, LOGOUT_PATH].includes(location.pathname)) navigate('/');
  }, []);

  return <SessionContext.Provider value={session}>{props.children}</SessionContext.Provider>;
}