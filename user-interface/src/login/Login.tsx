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
import { addApiAfterHook } from '@/lib/models/api';
import { http401Hook } from './http401-logout';
import getApiConfiguration from '@/configuration/apiConfiguration';
import { CamsUser } from '@common/cams/users';
import { CamsSession } from '@common/cams/session';
import { CamsRole } from '@common/cams/roles';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/offices';
import { initializeBroadcastLogout } from '@/login/broadcast-logout';
import LocalCache from '@/lib/utils/local-cache';
import DateHelper from '@common/date-helper';
import { Logout } from './Logout';

export type LoginProps = PropsWithChildren & {
  provider?: LoginProvider;
  user?: CamsUser;
  skipAuthorizedUseOnly?: boolean;
};

// Generate mock JWT token for 'none' login provider at runtime
function generateMockJWT(): string {
  const header = { typ: 'JWT', alg: 'HS256' };
  // Set expiration far in the future to avoid session timeout issues
  const futureExpiration = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year from now
  const payload = {
    iss: 'http://fake.issuer.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'fakeApi',
    exp: futureExpiration,
    groups: [],
  };
  // Generate signature at runtime to avoid base64 literals in source
  const signature = btoa('MOCK_SIGNATURE_FOR_TESTING_ONLY_NOT_REAL');

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

const MOCK_JWT = generateMockJWT();

// Inline mock superuser for 'none' login provider
const MOCK_SUPERUSER: CamsUser = {
  id: '==MOCKUSER=user@fake.com==',
  name: "Martha's Son",
  roles: Object.values(CamsRole),
  offices: MOCKED_USTP_OFFICES_ARRAY,
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
          accessToken={MOCK_JWT}
          user={props.user ?? MOCK_SUPERUSER}
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
