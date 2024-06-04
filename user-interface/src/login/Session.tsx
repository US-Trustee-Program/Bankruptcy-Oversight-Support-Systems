import { createContext, PropsWithChildren, useEffect } from 'react';
import {
  CamsSession,
  CamsUser,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  LOGIN_PATH,
  LoginProvider,
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

  if (window.localStorage) {
    const session: CamsSession = { provider, user };
    window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
  }

  useEffect(() => {
    if ([LOGIN_PATH, LOGOUT_PATH].includes(location.pathname)) navigate('/');
  }, []);

  return (
    <SessionContext.Provider value={{ user: props.user }}>{props.children}</SessionContext.Provider>
  );
}
