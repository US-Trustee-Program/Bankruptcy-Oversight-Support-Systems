import { PropsWithChildren, useEffect, useState } from 'react';
import { Session } from '@/login/Session';
import { CamsUser, LOGIN_LOCAL_STORAGE_SESSION_KEY } from '@/login/login-helpers';

export type OktaLoginProps = PropsWithChildren;

export function OktaLogin(props: OktaLoginProps): React.ReactNode {
  let storedUser: CamsUser | null = null;
  if (window.localStorage) {
    const userJson = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
    if (userJson) {
      storedUser = JSON.parse(userJson);
    }
  }
  const [user, setUser] = useState<CamsUser | null>(storedUser);

  useEffect(() => {
    setUser({ name: 'Okta User' });
  }, []);

  if (!user) return <></>;

  return (
    <Session provider="okta" user={user}>
      {props.children}
    </Session>
  );
}
