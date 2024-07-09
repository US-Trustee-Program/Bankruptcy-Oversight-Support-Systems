import { PropsWithChildren } from 'react';
import OktaAuth from '@okta/okta-auth-js';
import { Security } from '@okta/okta-react';
import { BadConfiguration } from '@/login/BadConfiguration';
import { getLoginConfigurationFromEnv, LOGIN_CONTINUE_PATH } from '@/login/login-library';
import { EnvLoginConfig } from '../../../../../common/src/cams/login';
import { registerSemaphore, useSemaphore } from '@/lib/utils/semaphore';
import { addApiBeforeHook } from '@/lib/hooks/UseApi';
import LocalStorage from '@/lib/utils/local-storage';

const SAFE_LIMIT = 30; // Seconds

const OKTA_TOKEN_REFRESH = 'OKTA_TOKEN_REFRESH';
registerSemaphore(OKTA_TOKEN_REFRESH);

export type OktaProviderProps = PropsWithChildren;

export function OktaProvider(props: OktaProviderProps) {
  try {
    const config = getLoginConfigurationFromEnv<EnvLoginConfig>();
    const { protocol, host } = window.location;
    config.redirectUri = `${protocol}//${host}${LOGIN_CONTINUE_PATH}`;
    const oktaAuth = new OktaAuth(config);

    addApiBeforeHook(async () => {
      const session = LocalStorage.getSession();
      if (!session || !session.validatedClaims.exp) return;

      const now = Math.floor(Date.now() / 1000);
      const expiresLimit = now + SAFE_LIMIT;
      // const expires = session.validatedClaims.exp as number;
      // const expiresLimit = expires - SAFE_LIMIT;

      if (now > expiresLimit) {
        console.log('Executing refresh....');
        const semaphore = useSemaphore(OKTA_TOKEN_REFRESH);
        const receipt = semaphore.lock();
        if (receipt) {
          try {
            const apiToken = await oktaAuth.getOrRenewAccessToken();
            if (apiToken) {
              // TODO: Rebuild the session from the new access token.
              LocalStorage.setSession({
                ...session,
                apiToken,
              });
            }
          } finally {
            semaphore.unlock(receipt);
          }
        }
      }
    });

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
