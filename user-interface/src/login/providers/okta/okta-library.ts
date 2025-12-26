import OktaAuth, { UserClaims } from '@okta/okta-auth-js';
import LocalStorage from '@/lib/utils/local-storage';
import DateHelper from '@common/date-helper';
import Api2 from '@/lib/models/api2';
import { initializeSessionEndLogout } from '@/login/session-end-logout';

const SAFE_LIMIT = 300;
const HEARTBEAT = 1000 * 60 * 5;

// Custom event names
export const AUTH_EXPIRY_WARNING = 'auth-expiry-warning';

export function registerRenewOktaToken(oktaAuth: OktaAuth) {
  startHeartbeat(() => handleHeartbeat(oktaAuth));
  // TODO: this depends on the API to renew (which is likely a logic error)
  // addApiBeforeHook(async () => renewOktaToken(oktaAuth));
}

export function getCamsUser(oktaUser: UserClaims | null) {
  return { id: oktaUser?.sub ?? 'UNKNOWN', name: oktaUser?.name ?? oktaUser?.email ?? 'UNKNOWN' };
}

function startHeartbeat(closureFn: () => void) {
  setInterval(closureFn, HEARTBEAT);
}

export function isActive() {
  const now = Date.now();
  const lastInteraction = LocalStorage.getLastInteraction();

  if (!lastInteraction) {
    return false;
  }

  const timeElapsed = now - lastInteraction;
  return timeElapsed < HEARTBEAT;
}

export async function handleHeartbeat(oktaAuth: OktaAuth) {
  const now = DateHelper.nowInSeconds();
  const session = LocalStorage.getSession();
  if (!session) return;

  const expiration = session.expires;
  const expirationLimit = expiration - SAFE_LIMIT;

  if (now > expirationLimit) {
    if (isActive()) {
      // if close to expiry and user active, renew token
      renewOktaToken(oktaAuth);
    } else {
      // if close to expiry and user inactive, pop popup
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
    }
  } else {
    startHeartbeat(() => handleHeartbeat(oktaAuth));
  }
}

export async function renewOktaToken(oktaAuth: OktaAuth) {
  const isTokenBeingRenewed = LocalStorage.isTokenBeingRenewed();
  if (isTokenBeingRenewed === undefined || isTokenBeingRenewed) {
    return;
  }
  LocalStorage.setRenewingToken();
  try {
    const accessToken = await oktaAuth.getOrRenewAccessToken();
    const oktaUser = await oktaAuth.getUser();
    if (accessToken) {
      const jwt = oktaAuth.token.decode(accessToken);
      // Set the skeleton of a CamsSession object in local storage for the API.
      LocalStorage.setSession({
        provider: 'okta',
        accessToken,
        user: getCamsUser(oktaUser),
        expires: jwt.payload.exp ?? 0,
        issuer: jwt.payload.iss ?? '',
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
    LocalStorage.removeRenewingToken();
  }
}
