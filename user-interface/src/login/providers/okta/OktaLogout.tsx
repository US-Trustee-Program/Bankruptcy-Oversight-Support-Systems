import { BadConfiguration } from '@/login/BadConfiguration';
import { LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME } from '@/login/login-helpers';
import { SessionEnd } from '@/login/SessionEnd';
import OktaAuth from '@okta/okta-auth-js';
import { Security, useOktaAuth } from '@okta/okta-react';
import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';

// export function OktaLogout() {
//   return <SessionEnd />;
// }

export function OktaLogout() {
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
        <Route path="*" element={<OktaLogoutAction />} />
      </Routes>
    </Security>
  );
}

function OktaLogoutAction() {
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
