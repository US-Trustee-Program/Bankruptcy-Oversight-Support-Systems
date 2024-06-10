import React, { PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import { AzureLogin } from './providers/azure/AzureLogin';
import { MockLogin } from './providers/mock/MockLogin';
import { AuthorizedUseOnly } from './AuthorizedUseOnly';
import { Logout } from './Logout';
import { Session } from './Session';
import {
  CamsUser,
  LOGIN_PROVIDER_ENV_VAR_NAME,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
  getLoginProviderFromEnv,
  LoginProvider,
  LOGOUT_PATH,
  CamsSession,
} from './login-helpers';
import { BadConfiguration } from './BadConfiguration';
import { OktaLogin } from './providers/okta/OktaLogin';

export type LoginProps = PropsWithChildren & {
  provider?: LoginProvider;
  user?: CamsUser;
  skipAuthorizedUseOnly?: boolean;
};

export default function Login(props: LoginProps): React.ReactNode {
  const provider = props.provider?.toString().toLowerCase() ?? getLoginProviderFromEnv();
  const location = useLocation();

  const isLogout = location.pathname === LOGOUT_PATH;
  if (isLogout) return <Logout />;

  const isContinuation = location.pathname === '/login-continuation';

  let session: CamsSession | null = null;
  let user: CamsUser | null = null;
  if (!isContinuation && window.localStorage) {
    const sessionJson = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
    if (sessionJson) {
      session = JSON.parse(sessionJson);
      user = session?.user ?? null;
    }
    if (session?.provider !== provider) {
      window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
      user = null;
    }
  }

  const errorMessage =
    'Login provider not specified or not a valid option.\n' +
    `Valid options are 'azure' | 'okta' | 'mock' | 'none'.\n` +
    `Build variable name: '${LOGIN_PROVIDER_ENV_VAR_NAME}'.\n` +
    `Build variable value: '${provider}'.`;

  let providerComponent;
  switch (provider) {
    case 'azure':
      providerComponent = <AzureLogin>{props.children}</AzureLogin>;
      break;
    case 'okta':
      providerComponent = <OktaLogin>{props.children}</OktaLogin>;
      break;
    case 'mock':
      providerComponent = <MockLogin user={user}>{props.children}</MockLogin>;
      break;
    case 'none':
      providerComponent = (
        <Session provider={provider} user={props.user ?? { name: 'Super User' }}>
          {props.children}
        </Session>
      );
      break;
    default:
      // TODO: Log this to app insights.
      providerComponent = <BadConfiguration message={errorMessage} />;
  }

  return (
    <AuthorizedUseOnly skip={!!props.skipAuthorizedUseOnly || provider === 'none'}>
      {providerComponent}
    </AuthorizedUseOnly>
  );
}
