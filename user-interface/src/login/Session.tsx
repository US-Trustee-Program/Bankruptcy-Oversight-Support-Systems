import { createContext, PropsWithChildren } from 'react';
import { CamsUser } from './login-helpers';
// import { useNavigate } from 'react-router-dom';

export type SessionContextType = {
  user: CamsUser | null;
};

export const SessionContext = createContext<SessionContextType>({
  user: null,
});

export type SessionProps = PropsWithChildren & {
  user: CamsUser;
};

export function Session(props: SessionProps) {
  // TODO: We need to store the user in local storage.
  // if (window.localStorage) {
  //   window.localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(props.user));
  // }
  // const navigate = useNavigate();
  // useEffect(() => {
  //   navigate('/search');
  // }, []);
  return (
    <SessionContext.Provider value={{ user: props.user }}>{props.children}</SessionContext.Provider>
  );
}
