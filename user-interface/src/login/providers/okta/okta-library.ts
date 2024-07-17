import OktaAuth from '@okta/okta-auth-js';
import LocalStorage from '@/lib/utils/local-storage';
import { registerSemaphore, useSemaphore } from '@/lib/utils/semaphore';
import { addApiBeforeHook } from '@/lib/models/api';

const SAFE_LIMIT = 300;

const OKTA_TOKEN_REFRESH = 'OKTA_TOKEN_REFRESH';
registerSemaphore(OKTA_TOKEN_REFRESH);

export function registerRefreshOktaToken(oktaAuth: OktaAuth) {
  addApiBeforeHook(async () => refreshOktaToken(oktaAuth));
}

export async function refreshOktaToken(oktaAuth: OktaAuth) {
  const now = Math.floor(Date.now() / 1000);
  const session = LocalStorage.getSession();
  if (!session || !session.validatedClaims.exp) return;

  const expiration = session.validatedClaims.exp as number;
  const expirationLimit = expiration - SAFE_LIMIT;

  const seconds = expirationLimit - now;
  const hoursRemaining = Math.floor(seconds / 3600);
  const minutesRemaining = Math.floor((seconds - hoursRemaining * 3600) / 60);
  const secondsRemaining = seconds - hoursRemaining * 3600 - minutesRemaining * 60;
  console.log('refreshing in', `${hoursRemaining}:${minutesRemaining}:${secondsRemaining}`);

  if (now > expirationLimit) {
    const semaphore = useSemaphore(OKTA_TOKEN_REFRESH);
    const receipt = semaphore.lock();
    if (receipt) {
      const authState = oktaAuth.authStateManager.getAuthState();
      try {
        console.log('refreshing okta token...');
        if (authState?.isAuthenticated) {
          const apiToken = await oktaAuth.getOrRenewAccessToken();
          const oktaUser = await oktaAuth.getUser();

          if (apiToken) {
            console.log('updating local storage...');
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
        console.log('refreshing okta token... done.');
        semaphore.unlock(receipt);
      }
    }
  }
}
