import { AccessDenied } from '@/login/AccessDenied';
import { Interstitial } from '@/login/Interstitial';
import { Session } from '@/login/Session';
import { useOktaAuth } from '@okta/okta-react';
import { PropsWithChildren, useEffect, useState } from 'react';
import { registerRefreshOktaToken } from './okta-library';
import { getAppInsights } from '@/lib/hooks/UseApplicationInsights';

export type OktaSessionProps = PropsWithChildren;

export function OktaSession(props: OktaSessionProps) {
  const { appInsights } = getAppInsights();
  const [redirectComplete, setRedirectComplete] = useState<boolean>(false);
  const [callbackError, setCallbackError] = useState<Error | null>(null);

  const { oktaAuth, authState } = useOktaAuth();

  useEffect(() => {
    oktaAuth
      .handleLoginRedirect()
      .then(() => {
        setRedirectComplete(true);
        appInsights.trackEvent({ name: 'Okta redirect complete' }, { status: 'success' });
      })
      .catch((e) => {
        const error = e as Error;
        appInsights.trackEvent({ name: 'Okta redirect error' }, { status: 'error level 0' });
        // Only report if the error is not the parse error during the continuation redirects.
        if (error.message !== 'Unable to parse a token from the url') {
          setCallbackError(error);
        }
      });
  }, [oktaAuth, !authState?.error]);

  if (authState?.error || callbackError) {
    const message = authState?.error?.message ?? callbackError?.message;
    appInsights.trackEvent({ name: 'Access Denied' }, { message });
    return <AccessDenied message={message} />;
  }

  if (!redirectComplete) {
    return <Interstitial id="interstital-continue" caption="Continue from Okta..."></Interstitial>;
  }

  const accessToken = oktaAuth.getAccessToken();

  if (!accessToken) {
    appInsights.trackEvent(
      { name: 'Access Denied' },
      { message: 'Could not get access token from auth client.' },
    );
    return <AccessDenied />;
  }
  const oktaJwt = oktaAuth.token.decode(accessToken);

  if (!oktaJwt.payload.iss || !oktaJwt.payload.exp) {
    const message = 'Invalid issuer or expiration claims.';
    appInsights.trackEvent({ name: 'Access Denied' }, { message });
    return <AccessDenied message={message} />;
  }

  const expires = oktaJwt.payload.exp;
  const issuer = oktaJwt.payload.iss;

  registerRefreshOktaToken(oktaAuth);

  appInsights.trackEvent({ name: 'Okta session established' }, { status: 'success' });
  return (
    <Session provider="okta" accessToken={accessToken} expires={expires} issuer={issuer}>
      {props.children}
    </Session>
  );
}
