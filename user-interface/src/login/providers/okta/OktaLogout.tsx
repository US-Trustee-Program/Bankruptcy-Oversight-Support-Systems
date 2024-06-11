import { useEffect, useState } from 'react';
import { SessionEnd } from '@/login/SessionEnd';
import { useOktaAuth } from '@okta/okta-react';

export function OktaLogout() {
  const [loggedOut, setLoggedOut] = useState<boolean>(false);

  const { oktaAuth } = useOktaAuth();

  async function logout() {
    oktaAuth.clearStorage();
  }

  useEffect(() => {
    logout().then(() => {
      setLoggedOut(true);
    });
  }, []);

  if (!loggedOut) return <></>;
  return <SessionEnd />;
}
