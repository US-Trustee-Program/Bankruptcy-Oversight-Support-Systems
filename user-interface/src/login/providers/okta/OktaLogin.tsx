import { PropsWithChildren, useEffect } from 'react';
import OktaAuth from '@okta/okta-auth-js';
import { Security, useOktaAuth } from '@okta/okta-react';
import { Route, Routes } from 'react-router-dom';
import { AccessDenied } from '@/login/AccessDenied';
import { OktaSession } from './OktaSession';
import { LOGIN_CONTINUE_PATH, LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME } from '@/login/login-helpers';
import { BadConfiguration } from '@/login/BadConfiguration';

export type OktaLoginProps = PropsWithChildren;

export function OktaLogin(props: OktaLoginProps) {
  const authConfigJson = import.meta.env[LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME];
  if (!authConfigJson) return <BadConfiguration message="Missing authentication configuration" />;

  let authConfig;
  try {
    authConfig = JSON.parse(authConfigJson);
  } catch (e) {
    return <BadConfiguration message={(e as Error).message} />;
  }
  const oktaAuth = new OktaAuth(authConfig);

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={() => {}}>
      <Routes>
        <Route path={LOGIN_CONTINUE_PATH} element={<OktaSession>{props.children}</OktaSession>} />
        <Route path="*" element={<OktaUnauthenticated>{props.children}</OktaUnauthenticated>} />
      </Routes>
    </Security>
  );
}

function OktaUnauthenticated(props: PropsWithChildren) {
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
    return <div>Logging in</div>;
  }

  if (authState && authState.isAuthenticated) return <OktaSession>{props.children}</OktaSession>;

  return <AccessDenied />;
}
