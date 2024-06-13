import { PropsWithChildren } from 'react';
import OktaAuth from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import { LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME } from '@/login/login-library';
import { BadConfiguration } from '@/login/BadConfiguration';

export type OktaProviderProps = PropsWithChildren;

export function OktaProvider(props: OktaProviderProps) {
  const authConfigJson = import.meta.env[LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME];
  if (!authConfigJson) return <BadConfiguration message="Missing authentication configuration" />;

  let authConfig;
  try {
    authConfig = JSON.parse(authConfigJson);
  } catch (e) {
    return <BadConfiguration message={(e as Error).message} />;
  }
  const oktaAuth = new OktaAuth(authConfig);

  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={() => {}}>
      {props.children}
    </Security>
  );
}
