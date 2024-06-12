import { PropsWithChildren, useEffect } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { AccessDenied } from '@/login/AccessDenied';
import { OktaSession } from './OktaSession';
import { Interstitial } from '@/login/Interstitial';

export type OktaLoginProps = PropsWithChildren;

export function OktaLogin(props: PropsWithChildren) {
  const { oktaAuth, authState } = useOktaAuth();

  useEffect(() => {
    if (!authState) {
      return;
    }

    if (!authState?.isAuthenticated) {
      oktaAuth.signInWithRedirect();
    }
  }, [oktaAuth, !!authState, authState?.isAuthenticated]);

  if (!authState || !authState?.isAuthenticated) {
    return <Interstitial message="Logging in"></Interstitial>;
  }

  if (authState && authState.isAuthenticated) return <OktaSession>{props.children}</OktaSession>;

  return <AccessDenied />;
}