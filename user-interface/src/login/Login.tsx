import React, { PropsWithChildren } from 'react';
import { MockLogin } from './providers/mock/MockLogin';
import { AuthorizedUseOnly } from './AuthorizedUseOnly';
import { Session } from './Session';
import {
  getLoginProvider,
  LoginProvider,
  isLoginProviderType,
  getAuthIssuer,
} from './login-library';
import { BadConfiguration } from './BadConfiguration';
import { OktaLogin } from './providers/okta/OktaLogin';
import { OktaProvider } from './providers/okta/OktaProvider';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import { addApiAfterHook } from '@/lib/models/api';
import { http401Hook } from './http401-logout';
import { initializeInactiveLogout } from './inactive-logout';
import getApiConfiguration from '@/configuration/apiConfiguration';
import { CamsUser } from '@common/cams/users';
import { CamsSession } from '@common/cams/session';
import { SUPERUSER } from '@common/cams/test-utilities/mock-user';
import { initializeBroadcastLogout } from '@/login/broadcast-logout';
import LocalCache from '@/lib/utils/local-cache';
import DateHelper from '@common/date-helper';
import { Logout } from './Logout';

export type LoginProps = PropsWithChildren & {
  provider?: LoginProvider;
  user?: CamsUser;
  skipAuthorizedUseOnly?: boolean;
};

const config = getApiConfiguration();

export function Login(props: LoginProps): React.ReactNode {
  const provider = props.provider?.toString().toLowerCase() ?? getLoginProvider();
  let issuer;
  if (!isLoginProviderType(provider)) {
    const errorMessage =
      'Login provider not specified or not a valid option.\n' +
      `Valid options are 'okta' | 'mock' | 'dev' | 'none'.\n` +
      `Configuration variable name: 'CAMS_LOGIN_PROVIDER'.\n` +
      `Configuration variable value: '${provider}'.`;
    return <BadConfiguration message={errorMessage} />;
  }

  LocalCache.purge();
  addApiAfterHook(http401Hook);
  initializeInactiveLogout();
  initializeBroadcastLogout();

  const session: CamsSession | null = LocalStorage.getSession();

  if (session && session.expires < DateHelper.nowInSeconds()) {
    return <Logout></Logout>;
  }

  if (session) {
    if (provider == 'okta') {
      issuer = getAuthIssuer();
    } else if (provider === 'mock') {
      const { protocol, server, port, basePath } = config;
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
    case 'okta':
      providerComponent = (
        <OktaProvider>
          <OktaLogin />
        </OktaProvider>
      );
      break;
    case 'mock':
      providerComponent = <MockLogin user={props.user ?? null}>{props.children}</MockLogin>;
      break;
    case 'none':
      providerComponent = (
        <Session
          provider="none"
          accessToken={MockData.getJwt()}
          user={props.user ?? SUPERUSER.user}
          expires={Number.MAX_SAFE_INTEGER}
          issuer={issuer ?? ''}
        >
          {props.children}
        </Session>
      );
      break;
  }

  return (
    <AuthorizedUseOnly skip={!!props.skipAuthorizedUseOnly || provider === 'none'}>
      {providerComponent}
    </AuthorizedUseOnly>
  );
}
