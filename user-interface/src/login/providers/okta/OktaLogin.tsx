import { Interstitial } from '@/login/Interstitial';
import { useOktaAuth } from '@okta/okta-react';
import { useEffect } from 'react';

export function OktaLogin() {
  const { authState, oktaAuth } = useOktaAuth();

  useEffect(() => {
    oktaAuth.signInWithRedirect();
  }, [oktaAuth, authState]);

  return <Interstitial caption="Logging in..." id="interstitial-login"></Interstitial>;
}
