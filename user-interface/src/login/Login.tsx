import React, { PropsWithChildren } from 'react';
import { AzureLogin } from './providers/azure/AzureLogin';
import { MockLogin } from './providers/mock/MockLogin';
import { AuthorizedUseOnly } from './AuthorizedUseOnly';
import { Session } from './Session';
import {
  CamsUser,
  LOGIN_PROVIDER_ENV_VAR_NAME,
  getLoginProviderFromEnv,
  LoginProvider,
  CamsSession,
  LOGIN_LOCAL_STORAGE_SESSION_KEY,
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

  function getCurrentSession() {
    let session: CamsSession | null = null;
    if (window.localStorage) {
      const sessionJson = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
      if (sessionJson) {
        session = JSON.parse(sessionJson);
        if (session?.provider !== provider) {
          window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
          session = null;
        }
      }
    }
    return session;
  }

  // Skip to session and continue if already logged in.
  const session = getCurrentSession();
  if (session && session.provider && session.user) {
    return (
      <Session provider={session.provider!} user={session.user!}>
        {props.children}
      </Session>
    );
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
      providerComponent = <MockLogin user={props.user ?? null}>{props.children}</MockLogin>;
      break;
    case 'none':
      providerComponent = (
        <Session provider={provider} user={props.user ?? { name: 'Super User' }}>
          {props.children}
        </Session>
      );
      break;
    default:
      providerComponent = <BadConfiguration message={errorMessage} />;
  }

  return (
    <AuthorizedUseOnly skip={!!props.skipAuthorizedUseOnly || provider === 'none'}>
      {providerComponent}
    </AuthorizedUseOnly>
  );
}
