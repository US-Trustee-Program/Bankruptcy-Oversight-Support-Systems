import React, { PropsWithChildren } from 'react';
import { MockLogin } from './providers/mock/MockLogin';
import { AuthorizedUseOnly } from './AuthorizedUseOnly';
import { Session } from './Session';
import {
  CamsUser,
  LOGIN_PROVIDER_ENV_VAR_NAME,
  getLoginProviderFromEnv,
  LoginProvider,
  getSessionfromLocalStorage,
  isLoginProviderType,
} from './login-library';
import { BadConfiguration } from './BadConfiguration';
import { OktaLogin } from './providers/okta/OktaLogin';
import { OktaProvider } from './providers/okta/OktaProvider';

export type LoginProps = PropsWithChildren & {
  provider?: LoginProvider;
  user?: CamsUser;
  skipAuthorizedUseOnly?: boolean;
};

export function Login(props: LoginProps): React.ReactNode {
  const provider = props.provider?.toString().toLowerCase() ?? getLoginProviderFromEnv();

  if (!isLoginProviderType(provider)) {
    const errorMessage =
      'Login provider not specified or not a valid option.\n' +
      `Valid options are 'okta' | 'mock' | 'none'.\n` +
      `Build variable name: ${LOGIN_PROVIDER_ENV_VAR_NAME}.\n` +
      `Build variable value: ${provider ?? 'IS BLANK'}.`;
    return <BadConfiguration message={errorMessage} />;
  }

  // Skip to session and continue if already logged in.
  const session = getSessionfromLocalStorage(provider);
  if (session && session.provider && session.user) {
    return (
      <Session provider={session.provider!} user={session.user!}>
        {props.children}
      </Session>
    );
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
        <Session provider={provider} user={props.user ?? { name: 'Super User' }}>
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
