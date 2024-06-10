import { AccessDenied } from '@/login/AccessDenied';
import { CamsUser } from '@/login/login-helpers';
import { Session } from '@/login/Session';
import { UserClaims } from '@okta/okta-auth-js';
import { useOktaAuth } from '@okta/okta-react';
import { PropsWithChildren, useEffect, useState } from 'react';

export type OktaSessionProps = PropsWithChildren;

export function OktaSession(props: OktaSessionProps) {
  const [oktaUser, setOktaUser] = useState<UserClaims | null>(null);
  const [callbackError, setCallbackError] = useState<Error | null>(null);

  const { oktaAuth, authState } = useOktaAuth();

  async function getCurrentUser() {
    const user = await oktaAuth.getUser();
    setOktaUser(user);
    console.log(oktaUser);
  }

  useEffect(() => {
    if (location.search) {
      oktaAuth.handleLoginRedirect().catch((e) => {
        setCallbackError(e);
      });
    } else {
      getCurrentUser();
    }
  }, [oktaAuth]);

  if (authState?.error || callbackError) {
    return <AccessDenied message={authState?.error?.message ?? callbackError?.message} />;
  }

  if (!oktaUser) return <></>;

  // Map Okta user information to CAMS user
  const camsUser: CamsUser = {
    name: oktaUser.name ?? oktaUser.email ?? 'UNKNOWN',
  };

  return (
    <Session provider="okta" user={camsUser}>
      {props.children}
    </Session>
  );
}
