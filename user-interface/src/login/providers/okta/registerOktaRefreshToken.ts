import OktaAuth from '@okta/okta-auth-js';
import LocalStorage from '@/lib/utils/local-storage';
import { registerSemaphore, useSemaphore } from '@/lib/utils/semaphore';
import { addApiBeforeHook } from '@/lib/models/api';

const SAFE_LIMIT = 30; // Seconds

const OKTA_TOKEN_REFRESH = 'OKTA_TOKEN_REFRESH';
registerSemaphore(OKTA_TOKEN_REFRESH);

export function registerOktaRefreshToken(oktaAuth: OktaAuth) {
  addApiBeforeHook(async () => {
    const now = Math.floor(Date.now() / 1000);
    const session = LocalStorage.getSession();
    if (!session || !session.validatedClaims.exp) return;

    const expiration = session.validatedClaims.exp as number;
    const expirationLimit = expiration - SAFE_LIMIT;

    if (now > expirationLimit) {
      const semaphore = useSemaphore(OKTA_TOKEN_REFRESH);
      const receipt = semaphore.lock();
      if (receipt) {
        const authState = oktaAuth.authStateManager.getAuthState();
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
            }
          }
        } catch {
          // failed to renew access token.
        } finally {
          semaphore.unlock(receipt);
        }
      }
    }
  });
}
