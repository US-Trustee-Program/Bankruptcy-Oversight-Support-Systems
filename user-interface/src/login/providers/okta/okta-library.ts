import OktaAuth, { UserClaims } from '@okta/okta-auth-js';
import LocalStorage from '@/lib/utils/local-storage';
import { addApiBeforeHook } from '@/lib/models/api';

const SAFE_LIMIT = 2700;

export function registerRefreshOktaToken(oktaAuth: OktaAuth) {
  addApiBeforeHook(async () => refreshOktaToken(oktaAuth));
}

export function getCamsUser(oktaUser: UserClaims | null) {
  // TODO: We need to decide which claim we map to the CamsUser.id
  return { id: oktaUser?.sub ?? 'UNKNOWN', name: oktaUser?.name ?? oktaUser?.email ?? 'UNKNOWN' };
}

export async function refreshOktaToken(oktaAuth: OktaAuth) {
  const now = Math.floor(Date.now() / 1000);
  const session = LocalStorage.getSession();
  if (!session) return;

  const expiration = session.expires;
  // THIS IS SUS....
  const expirationLimit = expiration - SAFE_LIMIT;

  if (now > expirationLimit) {
    const isTokenBeingRefreshed = LocalStorage.isTokenBeingRefreshed();
    if (isTokenBeingRefreshed === undefined || isTokenBeingRefreshed) {
      return;
    } else if (!isTokenBeingRefreshed) {
      // THIS IS SUS....
      const theTime = Math.floor(Math.random() * 15);
      setTimeout(() => refreshTheToken(oktaAuth), theTime);
    }
  }
}

async function refreshTheToken(oktaAuth: OktaAuth) {
  const isTokenBeingRefreshed = LocalStorage.isTokenBeingRefreshed();
  if (isTokenBeingRefreshed === undefined || isTokenBeingRefreshed) {
    return;
  }
  LocalStorage.setRefreshingToken();
  try {
    const accessToken = await oktaAuth.getOrRenewAccessToken();
    const oktaUser = await oktaAuth.getUser();
    if (accessToken) {
      const jwt = oktaAuth.token.decode(accessToken);
      // TODO: THIS REFRESH IS NOT "AUGMENTED". WE NEED TO CALL THE /me ENDPOINT.
      // Map Okta user information to CAMS user
      // TODO: This is the first of two calls to getUser, but this response is not the one we use. The api returns user details with the /me endpoint. Just skip this call??
      LocalStorage.setSession({
        provider: 'okta',
        accessToken,
        user: getCamsUser(oktaUser),
        expires: jwt.payload.exp ?? 0,
        issuer: jwt.payload.iss ?? '',
      });
    }
  } catch {
    // failed to renew access token.
  } finally {
    LocalStorage.removeRefreshingToken();
  }
}
