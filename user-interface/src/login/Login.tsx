import React, { PropsWithChildren, useEffect, useState } from 'react';
import AzureLogin from './providers/azure/AzureLogin';
import { AccessDenied } from './AccessDenied';
import { Session } from './Session';
import {
  CamsUser,
  LOGIN_PROVIDER_ENV_VAR_NAME,
  getLoginProviderFromEnv,
  LOGIN_LOCAL_STORAGE_USER_KEY,
  LoginProvider,
} from './login-helpers';
import MockLogin from './providers/mock/MockLogin';
import { useLocation } from 'react-router-dom';
import { Logout } from './Logout';
import { AuthorizedUseOnly } from './AuthorizedUseOnly';

export type LoginProps = PropsWithChildren & {
  provider?: LoginProvider;
  user?: CamsUser;
  skipAuthorizedUseOnly?: boolean;
};

export default function Login(props: LoginProps): React.ReactNode {
  const [isLocalStorageRead, setIsLocalStorageRead] = useState<boolean>(false);
  const [user, setUser] = useState<CamsUser | null>(null);
  const location = useLocation();
  const children = location.pathname === '/logout' ? <Logout></Logout> : props.children;

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
      providerComponent = <AzureLogin>{children}</AzureLogin>;
      break;
    case 'mock':
      providerComponent = <MockLogin user={user}>{children}</MockLogin>;
      break;
    case 'none':
      providerComponent = <Session user={props.user ?? { name: 'Super User' }}>{children}</Session>;
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
    <AuthorizedUseOnly skip={!!props.skipAuthorizedUseOnly}>{providerComponent}</AuthorizedUseOnly>
  );
}
