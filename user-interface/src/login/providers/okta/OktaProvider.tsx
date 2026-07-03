import { PropsWithChildren, useEffect } from 'react';
import OktaAuth from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import { BadConfiguration } from '@/login/BadConfiguration';
import { getLoginConfiguration, LOGIN_CONTINUE_PATH } from '@/login/login-library';
import { EnvLoginConfig } from '@common/cams/login';
import { registerRenewOktaToken, unregisterRenewOktaToken } from './okta-library';

export type OktaProviderProps = PropsWithChildren;

export function OktaProvider(props: OktaProviderProps) {
  try {
    const config = getLoginConfiguration<EnvLoginConfig>();
    const { protocol, host } = window.location;
    config.redirectUri = `${protocol}//${host}${LOGIN_CONTINUE_PATH}`;
    const requiredScopes = ['openid', 'profile', 'email'];
    const configuredScopes = (config as Record<string, unknown>).scopes;
    const baseScopes = Array.isArray(configuredScopes) ? (configuredScopes as string[]) : [];
    const mergedScopes = [...new Set([...baseScopes, ...requiredScopes])];
    const oktaAuth = new OktaAuth({ ...config, scopes: mergedScopes });

    useEffect(() => {
      registerRenewOktaToken(oktaAuth);

      return () => {
        unregisterRenewOktaToken();
      };
    }, []);

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
