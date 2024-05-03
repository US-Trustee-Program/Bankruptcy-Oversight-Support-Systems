import { createContext, PropsWithChildren } from 'react';
import { CamsUser } from './login-helpers';

export type SessionContextType = {
  user: CamsUser | null;
  // logout: () => void;
};

export const SessionContext = createContext<SessionContextType>({
  user: null,
  // logout: () => {},
});

export type SessionProps = PropsWithChildren & {
  user: CamsUser;
};

export function Session(props: SessionProps) {
  // if (window.localStorage) {
  //   window.localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(props.user));
  // }

  // function logout() {
  //   // TODO
  // }

  return (
    <SessionContext.Provider value={{ user: props.user }}>{props.children}</SessionContext.Provider>
  );
}
