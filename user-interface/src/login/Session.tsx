import { createContext, PropsWithChildren, useEffect } from 'react';
import { CamsUser, LOGIN_LOCAL_STORAGE_USER_KEY } from './login-helpers';
import { useNavigate } from 'react-router-dom';

export type SessionContextType = {
  user: CamsUser | null;
  logout: () => void;
};

export const SessionContext = createContext<SessionContextType>({
  user: null,
  logout: () => {},
});

export type SessionProps = PropsWithChildren & {
  user: CamsUser;
};

export function Session(props: SessionProps) {
  const navigate = useNavigate();

  if (window.localStorage) {
    window.localStorage.setItem(LOGIN_LOCAL_STORAGE_USER_KEY, JSON.stringify(props.user));
  }

  function logout() {
    // TODO: Logout things... maybe. Probably should reset the context with a null user.
    navigate('/logout');
  }

  useEffect(() => {
    navigate('/');
  }, []);

  return (
    <SessionContext.Provider value={{ user: props.user, logout }}>
      {props.children}
    </SessionContext.Provider>
  );
}
