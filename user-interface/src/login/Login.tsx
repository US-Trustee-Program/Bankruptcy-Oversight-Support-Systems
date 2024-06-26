import React, { PropsWithChildren } from 'react';
import { MockLogin } from './providers/mock/MockLogin';
import { AuthorizedUseOnly } from './AuthorizedUseOnly';
import { Session } from './Session';
import {
  LOGIN_PROVIDER_ENV_VAR_NAME,
  getLoginProviderFromEnv,
  LoginProvider,
  isLoginProviderType,
  getAuthIssuerFromEnv,
} from './login-library';
import { BadConfiguration } from './BadConfiguration';
import { OktaLogin } from './providers/okta/OktaLogin';
import { OktaProvider } from './providers/okta/OktaProvider';
import { LocalStorage } from '@/lib/utils/local-storage';
import { CamsSession, CamsUser } from '@common/cams/session';
import { MockData } from '@common/cams/test-utilities/mock-data';

export type LoginProps = PropsWithChildren & {
  provider?: LoginProvider;
  user?: CamsUser;
  skipAuthorizedUseOnly?: boolean;
};

export function Login(props: LoginProps): React.ReactNode {
  const issuer = getAuthIssuerFromEnv();
  const provider = props.provider?.toString().toLowerCase() ?? getLoginProviderFromEnv();

  if (!isLoginProviderType(provider)) {
    const errorMessage =
      'Login provider not specified or not a valid option.\n' +
      `Valid options are 'okta' | 'mock' | 'none'.\n` +
      `Build variable name: '${LOGIN_PROVIDER_ENV_VAR_NAME}'.\n` +
      `Build variable value: '${provider}'.`;
    return <BadConfiguration message={errorMessage} />;
  }

  const session: CamsSession | null = LocalStorage.getSession();
  if (session) {
    if (session.provider === provider && issuer === session.validatedClaims['iss']) {
      return <Session {...session}>{props.children}</Session>;
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
          apiToken={MockData.getJwt()}
          user={props.user ?? { name: 'Super User' }}
          validatedClaims={{}}
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
