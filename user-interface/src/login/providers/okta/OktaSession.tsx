import { AccessDenied } from '@/login/AccessDenied';
import { CamsUser } from '@/login/login-helpers';
import { Session } from '@/login/Session';
import { UserClaims } from '@okta/okta-auth-js';
import { useOktaAuth } from '@okta/okta-react';
import { PropsWithChildren, useEffect, useState } from 'react';

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
    oktaAuth
      .handleLoginRedirect()
      .then(() => {
        setRedirectComplete(true);
      })
      .catch((e) => {
        const error = e as Error;
        // Only report if the error is not the parse error during the continuation redirects.
        if (error.message !== 'Unable to parse a token from the url') {
          console.error(error.message);
        }
      });
  }, [oktaAuth]);

  useEffect(() => {
    if (redirectComplete && authState?.isAuthenticated) getCurrentUser();
  }, [redirectComplete, authState]);

  if (authState?.error || callbackError) {
    return <AccessDenied message={authState?.error?.message ?? callbackError?.message} />;
  }

  if (!redirectComplete && !oktaUser) return <div>Continue from Okta...</div>;
  if (redirectComplete && !oktaUser) return <div>Get user information...</div>;

  // Map Okta user information to CAMS user
  const camsUser: CamsUser = {
    name: oktaUser?.name ?? oktaUser?.email ?? 'UNKNOWN',
  };

  return (
    <Session provider="okta" user={camsUser}>
      {props.children}
    </Session>
  );
}
