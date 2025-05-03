import { addApiBeforeHook } from '@/lib/models/api';
import Api2 from '@/lib/models/api2';
import LocalStorage from '@/lib/utils/local-storage';
import { initializeSessionEndLogout } from '@/login/session-end-logout';
import { nowInSeconds } from '@common/date-helper';
import OktaAuth, { UserClaims } from '@okta/okta-auth-js';

const SAFE_LIMIT = 300;

export function getCamsUser(oktaUser: null | UserClaims) {
  return { id: oktaUser?.sub ?? 'UNKNOWN', name: oktaUser?.name ?? oktaUser?.email ?? 'UNKNOWN' };
}

export async function refreshOktaToken(oktaAuth: OktaAuth) {
  const now = nowInSeconds();
  const session = LocalStorage.getSession();
  if (!session) return;

  const expiration = session.expires;
  // THIS IS SUS....
  // TODO: FRITZ 04/07: This causing the No Permissions alert on the Staff Assignment screen
  // to come up any time the user is 5 min from expiration and none of the screen interaction works properly.
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

export function registerRefreshOktaToken(oktaAuth: OktaAuth) {
  addApiBeforeHook(async () => refreshOktaToken(oktaAuth));
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
      // Set the skeleton of a CamsSession object in local storage for the API.
      LocalStorage.setSession({
        accessToken,
        expires: jwt.payload.exp ?? 0,
        issuer: jwt.payload.iss ?? '',
        provider: 'okta',
        user: getCamsUser(oktaUser),
      });

      // Then call the /me endpoint to cache the Okta session on the API side and
      // and get the full CamsSession with CAMS-specific user detail not available
      // from Okta.
      const me = await Api2.getMe();
      LocalStorage.setSession(me.data);
      initializeSessionEndLogout(me.data);
    }
  } catch {
    // failed to renew access token.
  } finally {
    LocalStorage.removeRefreshingToken();
  }
}
