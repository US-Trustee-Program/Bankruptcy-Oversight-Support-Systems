import { createContext, PropsWithChildren, useEffect } from 'react';
import {
  CamsSession,
  CamsUser,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  LoginProvider,
  AUTHENTICATION_PATHS,
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
    // TODO: This entire block is suspect. Should we really override the session passed in from the upstream provider mapping??
    // let savedSession: CamsSession | undefined;
    // const savedSessionJson = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
    // if (savedSessionJson) {
    //   savedSession = JSON.parse(savedSessionJson);
    //   if (savedSession) {
    //     // TODO: We should probably check for differences before assuming savedSession is not stale.
    //     session = savedSession;
    //   }
    // }
    window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
  }

  useEffect(() => {
    if (AUTHENTICATION_PATHS.includes(location.pathname)) navigate('/');
  }, []);

  return <SessionContext.Provider value={session}>{props.children}</SessionContext.Provider>;
}
