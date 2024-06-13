import { useEffect } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { Interstitial } from '@/login/Interstitial';

export function OktaLogin() {
  const { oktaAuth, authState } = useOktaAuth();

  useEffect(() => {
    oktaAuth.signInWithRedirect();
  }, [oktaAuth, authState]);

  return <Interstitial id="interstitial-login" caption="Logging in..."></Interstitial>;
}
