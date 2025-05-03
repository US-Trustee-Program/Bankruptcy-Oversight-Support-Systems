import { BadConfiguration } from '@/login/BadConfiguration';
import { getLoginConfigurationFromEnv, LOGIN_CONTINUE_PATH } from '@/login/login-library';
import { EnvLoginConfig } from '@common/cams/login';
import OktaAuth from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import { PropsWithChildren } from 'react';

import { registerRefreshOktaToken } from './okta-library';

export type OktaProviderProps = PropsWithChildren;

export function OktaProvider(props: OktaProviderProps) {
  try {
    const config = getLoginConfigurationFromEnv<EnvLoginConfig>();
    const { host, protocol } = window.location;
    config.redirectUri = `${protocol}//${host}${LOGIN_CONTINUE_PATH}`;
    const oktaAuth = new OktaAuth(config);

    registerRefreshOktaToken(oktaAuth);

    return (
      <Security oktaAuth={oktaAuth} restoreOriginalUri={() => {}}>
        {props.children}
      </Security>
    );
  } catch (e) {
    const error = e as Error;
    return <BadConfiguration message={error.message} />;
  }
}
