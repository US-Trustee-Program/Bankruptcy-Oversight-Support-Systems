import { Interstitial } from '@/login/Interstitial';
import { SessionEnd } from '@/login/SessionEnd';
import { useOktaAuth } from '@okta/okta-react';
import { useEffect, useState } from 'react';

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

  if (!loggedOut) {
    return <Interstitial caption="Logging out..." id="interstital-logout"></Interstitial>;
  }
  return <SessionEnd />;
}
