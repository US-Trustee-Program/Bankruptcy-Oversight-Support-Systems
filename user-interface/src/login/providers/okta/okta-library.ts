import OktaAuth, { AuthState, UserClaims } from '@okta/okta-auth-js';
import LocalStorage from '@/lib/utils/local-storage';
import { registerSemaphore, useSemaphore } from '@/lib/utils/semaphore';
import { addApiBeforeHook } from '@/lib/models/api';

const SAFE_LIMIT = 300;

const OKTA_TOKEN_REFRESH = 'OKTA_TOKEN_REFRESH';
registerSemaphore(OKTA_TOKEN_REFRESH);

export function registerRefreshOktaToken(oktaAuth: OktaAuth) {
  addApiBeforeHook(async () => refreshOktaToken(oktaAuth));
}

export function getCamsUser(oktaUser: UserClaims | null) {
  return { name: oktaUser?.name ?? oktaUser?.email ?? 'UNKNOWN' };
}

export function getValidatedClaims(authState: AuthState | null) {
  return authState?.accessToken?.claims ?? {};
}

export async function refreshOktaToken(oktaAuth: OktaAuth) {
  const now = Math.floor(Date.now() / 1000);
  const session = LocalStorage.getSession();
  if (!session || !session.validatedClaims.exp) return;

  const expiration = session.validatedClaims.exp as number;
  const expirationLimit = expiration - SAFE_LIMIT;

  if (now > expirationLimit) {
    const semaphore = useSemaphore(OKTA_TOKEN_REFRESH);
    const receipt = semaphore.lock();
    if (receipt) {
      try {
        const authState = oktaAuth.authStateManager.getAuthState();
        if (authState?.isAuthenticated) {
          const apiToken = await oktaAuth.getOrRenewAccessToken();
          const oktaUser = await oktaAuth.getUser();
          const updatedAuthState = oktaAuth.authStateManager.getAuthState();

          if (apiToken) {
            LocalStorage.setSession({
              provider: 'okta',
              apiToken,
              user: getCamsUser(oktaUser),
              validatedClaims: getValidatedClaims(updatedAuthState),
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
}
