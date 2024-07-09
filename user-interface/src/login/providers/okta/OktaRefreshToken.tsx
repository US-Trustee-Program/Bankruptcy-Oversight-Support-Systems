import { PropsWithChildren } from 'react';
import { useOktaAuth } from '@okta/okta-react';
import { addApiBeforeHook } from '@/lib/hooks/UseApi';
import LocalStorage from '@/lib/utils/local-storage';
import { registerSemaphore, useSemaphore } from '@/lib/utils/semaphore';

const SAFE_LIMIT = 30; // Seconds

const OKTA_TOKEN_REFRESH = 'OKTA_TOKEN_REFRESH';
registerSemaphore(OKTA_TOKEN_REFRESH);

export type OktaRefreshTokenProps = PropsWithChildren;

export function OktaRefreshToken(props: OktaRefreshTokenProps) {
  const { oktaAuth, authState } = useOktaAuth();

  // TODO: How to not repeatedly add the hook to the API?
  // Use OktaAuth() and `oktaAuth.authStateManager.getAuthState()` to NOT use the React component lifecycle so we can register ONCE on app load?
  addApiBeforeHook(async () => {
    const now = Math.floor(Date.now() / 1000);
    const session = LocalStorage.getSession();
    if (!session || !session.validatedClaims.exp) return;

    const expiration = session.validatedClaims.exp as number;
    const expirationLimit = expiration - SAFE_LIMIT;

    console.log(`Refreshes in ${expirationLimit - now} seconds.`);

    if (now > expirationLimit) {
      console.log('Refreshing....');
      const semaphore = useSemaphore(OKTA_TOKEN_REFRESH);
      const receipt = semaphore.lock();
      if (receipt) {
        console.log('Locked...');
        try {
          if (authState?.isAuthenticated) {
            const apiToken = await oktaAuth.getOrRenewAccessToken();
            const oktaUser = await oktaAuth.getUser();

            if (apiToken) {
              LocalStorage.setSession({
                provider: 'okta',
                apiToken,
                user: {
                  name: oktaUser?.name ?? oktaUser?.email ?? 'UNKNOWN',
                },
                validatedClaims: authState?.accessToken?.claims ?? {},
              });
              console.log('new token', apiToken);
            }
          }
        } catch {
          // failed to renew access token.
        } finally {
          console.log('Unlocked...');
          semaphore.unlock(receipt);
        }
      }
    }
  });

  return props.children;
}
