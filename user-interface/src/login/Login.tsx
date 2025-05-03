import ApiConfiguration from '@/configuration/apiConfiguration';
import { addApiAfterHook } from '@/lib/models/api';
import LocalCache from '@/lib/utils/local-cache';
import { LocalStorage } from '@/lib/utils/local-storage';
import { initializeBroadcastLogout } from '@/login/broadcast-logout';
import { CamsSession } from '@common/cams/session';
import { MockData } from '@common/cams/test-utilities/mock-data';
import { SUPERUSER } from '@common/cams/test-utilities/mock-user';
import { CamsUser } from '@common/cams/users';
import { nowInSeconds } from '@common/date-helper';
import React, { PropsWithChildren } from 'react';

import { AuthorizedUseOnly } from './AuthorizedUseOnly';
import { BadConfiguration } from './BadConfiguration';
import { http401Hook } from './http401-logout';
import { initializeInactiveLogout } from './inactive-logout';
import {
  getAuthIssuerFromEnv,
  getLoginProviderFromEnv,
  isLoginProviderType,
  LOGIN_PROVIDER_ENV_VAR_NAME,
  LoginProvider,
} from './login-library';
import { Logout } from './Logout';
import { MockLogin } from './providers/mock/MockLogin';
import { OktaLogin } from './providers/okta/OktaLogin';
import { OktaProvider } from './providers/okta/OktaProvider';
import { Session } from './Session';

export type LoginProps = PropsWithChildren & {
  provider?: LoginProvider;
  skipAuthorizedUseOnly?: boolean;
  user?: CamsUser;
};

export function Login(props: LoginProps): React.ReactNode {
  const provider = props.provider?.toString().toLowerCase() ?? getLoginProviderFromEnv();
  let issuer;
  if (!isLoginProviderType(provider)) {
    const errorMessage =
      'Login provider not specified or not a valid option.\n' +
      `Valid options are 'okta' | 'mock' | 'none'.\n` +
      `Build variable name: '${LOGIN_PROVIDER_ENV_VAR_NAME}'.\n` +
      `Build variable value: '${provider}'.`;
    return <BadConfiguration message={errorMessage} />;
  }

  LocalCache.purge();
  addApiAfterHook(http401Hook);
  initializeInactiveLogout();
  initializeBroadcastLogout();

  const session: CamsSession | null = LocalStorage.getSession();

  if (session && session.expires < nowInSeconds()) {
    return <Logout></Logout>;
  }

  if (session) {
    if (provider == 'okta') {
      issuer = getAuthIssuerFromEnv();
    } else if (provider === 'mock') {
      const { basePath, port, protocol, server } = ApiConfiguration;
      const portString = port ? ':' + port : '';
      issuer = protocol + '://' + server + portString + basePath + '/oauth2/default';
    }
    if (session.provider === provider && issuer === session.issuer) {
      const sessionComponent = <Session {...session}>{props.children}</Session>;
      if (provider == 'okta') {
        return <OktaProvider>{sessionComponent}</OktaProvider>;
      } else {
        return sessionComponent;
      }
    } else {
      LocalStorage.removeSession();
    }
  }

  let providerComponent;
  switch (provider) {
    case 'mock':
      providerComponent = <MockLogin user={props.user ?? null}>{props.children}</MockLogin>;
      break;
    case 'none':
      providerComponent = (
        <Session
          accessToken={MockData.getJwt()}
          expires={Number.MAX_SAFE_INTEGER}
          issuer={issuer ?? ''}
          provider="none"
          user={props.user ?? SUPERUSER.user}
        >
          {props.children}
        </Session>
      );
      break;
    case 'okta':
      providerComponent = (
        <OktaProvider>
          <OktaLogin />
        </OktaProvider>
      );
      break;
  }

  return (
    <AuthorizedUseOnly skip={!!props.skipAuthorizedUseOnly || provider === 'none'}>
      {providerComponent}
    </AuthorizedUseOnly>
  );
}
