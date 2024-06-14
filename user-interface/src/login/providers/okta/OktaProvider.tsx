import { PropsWithChildren } from 'react';
import OktaAuth from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import { BadConfiguration } from '@/login/BadConfiguration';
import { getLoginConfigurationFromEnv, LOGIN_CONTINUE_PATH } from '@/login/login-library';

export type OktaConfig = {
  issuer: string;
  clientId: string;
  redirectUri: string;
};

export type OktaProviderProps = PropsWithChildren;

export function OktaProvider(props: OktaProviderProps) {
  try {
    const config = getLoginConfigurationFromEnv<OktaConfig>();
    const { protocol, host } = window.location;
    config.redirectUri = `${protocol}//${host}${LOGIN_CONTINUE_PATH}`;
    const oktaAuth = new OktaAuth(config);
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
