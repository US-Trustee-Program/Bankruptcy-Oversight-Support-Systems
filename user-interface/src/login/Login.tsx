import React, { PropsWithChildren, useEffect, useState } from 'react';
import AzureLogin from './providers/azure/AzureLogin';
import { AccessDenied } from './AccessDenied';
import { Session } from './Session';
import { AuthorizedUseOnlyGate } from './AuthorizedUseOnlyGate';
import {
  CamsUser,
  LOGIN_PROVIDER_ENV_VAR_NAME,
  getLoginProviderFromEnv,
  LOGIN_LOCAL_STORAGE_USER_KEY,
  LoginProvider,
} from './login-helpers';
import MockLogin from './providers/mock/MockLogin';
import { Route, Routes } from 'react-router-dom';
import { Logout } from './Logout';

export type LoginProps = PropsWithChildren & {
  provider?: LoginProvider;
};

export default function Login(props: LoginProps): React.ReactNode {
  const [isLocalStorageRead, setIsLocalStorageRead] = useState<boolean>(false);
  const [user, setUser] = useState<CamsUser | null>(null);

  useEffect(() => {
    if (window.localStorage) {
      const userJson = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_USER_KEY);
      if (userJson) {
        setUser(JSON.parse(userJson));
      }
    }
    setIsLocalStorageRead(true);
  }, []);

  if (!isLocalStorageRead) return <></>;

  const provider = props.provider?.toString().toLowerCase() ?? getLoginProviderFromEnv();

  let providerComponent;
  switch (provider) {
    case 'azure':
      providerComponent = <AzureLogin>{props.children}</AzureLogin>;
      break;
    case 'mock':
      providerComponent = <MockLogin user={user}>{props.children}</MockLogin>;
      break;
    case 'none':
      providerComponent = <Session user={{ name: 'Super User' }}>{props.children}</Session>;
      break;
    default:
      // TODO: Log this to app insights.
      console.error(
        'Login provider not specified or not a valid option.',
        `Valid options are 'azure' | 'openid' | 'mock' | 'none'.`,
        `Build variable name: '${LOGIN_PROVIDER_ENV_VAR_NAME}'.`,
        `Build variable value: '${provider}'.`,
      );
      providerComponent = <AccessDenied />;
  }

  return (
    <>
      <Routes>
        <Route path="/logout" element={<Logout />}></Route>
        <Route
          path="*"
          element={<AuthorizedUseOnlyGate>{providerComponent}</AuthorizedUseOnlyGate>}
        ></Route>
      </Routes>
    </>
  );
}
