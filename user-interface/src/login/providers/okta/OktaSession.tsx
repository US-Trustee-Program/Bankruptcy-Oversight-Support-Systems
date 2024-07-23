import { CamsUser } from '@common/cams/session';
import { AccessDenied } from '@/login/AccessDenied';
import { Interstitial } from '@/login/Interstitial';
import { Session } from '@/login/Session';
import { UserClaims } from '@okta/okta-auth-js';
import { useOktaAuth } from '@okta/okta-react';
import { PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { getCamsUser, registerRefreshOktaToken } from './okta-library';

export type OktaSessionProps = PropsWithChildren;

export function OktaSession(props: OktaSessionProps) {
  const [oktaUser, setOktaUser] = useState<UserClaims | null>(null);
  const [redirectComplete, setRedirectComplete] = useState<boolean>(false);
  const [callbackError, setCallbackError] = useState<Error | null>(null);

  const { oktaAuth, authState } = useOktaAuth();

  async function getCurrentUser() {
    try {
      const user = await oktaAuth.getUser();
      setOktaUser(user);
    } catch (e) {
      setCallbackError(e as Error);
    }
  }

  useEffect(() => {
    if (redirectComplete && authState?.isAuthenticated) getCurrentUser();
  }, [redirectComplete, authState]);

  const handleLoginRedirect = useCallback(async () => {
    try {
      await oktaAuth.handleLoginRedirect();
      setRedirectComplete(true);
      Promise.resolve(true);
    } catch (e) {
      const error = e as Error;
      // Only report if the error is not the parse error during the continuation redirects.
      if (error.message !== 'Unable to parse a token from the url') {
        setCallbackError(error);
      }
      Promise.reject(false);
    }
  }, []);

  useEffect(() => {
    handleLoginRedirect();
  }, [oktaAuth, !authState?.error]);

  if (authState?.error || callbackError) {
    return <AccessDenied message={authState?.error?.message ?? callbackError?.message} />;
  }

  if (!redirectComplete && !oktaUser) {
    return <Interstitial id="interstital-continue" caption="Continue from Okta..."></Interstitial>;
  }

  if (redirectComplete && !oktaUser) {
    setRedirectComplete(false);
    return <Interstitial id="interstital-getuser" caption="Get user information..."></Interstitial>;
  }

  // Map Okta user information to CAMS user
  const camsUser: CamsUser = getCamsUser(oktaUser);
  const accessToken = oktaAuth.getAccessToken();
  const expires = authState?.accessToken?.claims?.exp ?? 0;
  const issuer = authState?.accessToken?.claims.iss ?? '';

  if (!accessToken) {
    return <AccessDenied />;
  }

  registerRefreshOktaToken(oktaAuth);

  return (
    <Session
      provider="okta"
      user={camsUser}
      accessToken={accessToken}
      expires={expires}
      issuer={issuer}
    >
      {props.children}
    </Session>
  );
}
