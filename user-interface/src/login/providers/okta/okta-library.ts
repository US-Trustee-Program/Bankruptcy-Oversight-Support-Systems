import OktaAuth, { UserClaims } from '@okta/okta-auth-js';
import LocalStorage from '@/lib/utils/local-storage';
import DateHelper from '@common/date-helper';
import Api2 from '@/lib/models/api2';
import {
  AUTH_EXPIRY_WARNING,
  HEARTBEAT,
  SAFE_LIMIT,
  SESSION_TIMEOUT,
  LOGOUT_TIMER,
  createTimer,
  isUserActive,
  getLastInteraction,
  Timer,
} from '@/login/session-timer';

let heartbeatTimer: Timer | null = null;
let logoutTimer: Timer | null = null;
let warningShown = false;
let isRenewingToken = false;

export function resetWarningShownFlag() {
  warningShown = false;
}

export function registerRenewOktaToken(oktaAuth: OktaAuth) {
  if (heartbeatTimer) {
    heartbeatTimer.clear();
  }
  heartbeatTimer = createTimer(() => handleHeartbeat(oktaAuth), HEARTBEAT);
}

export function getCamsUser(oktaUser: UserClaims | null) {
  return { id: oktaUser?.sub ?? 'UNKNOWN', name: oktaUser?.name ?? oktaUser?.email ?? 'UNKNOWN' };
}

export function isActive() {
  return isUserActive(getLastInteraction(), HEARTBEAT);
}

export async function handleHeartbeat(oktaAuth: OktaAuth) {
  const now = DateHelper.nowInSeconds();
  const session = LocalStorage.getSession();
  if (!session) return;

  const expiration = session.expires;
  const expirationLimit = expiration - SAFE_LIMIT;

  if (now > expirationLimit) {
    if (isActive()) {
      await renewOktaToken(oktaAuth);
      if (logoutTimer) {
        logoutTimer.clear();
        logoutTimer = null;
      }
    } else {
      if (!warningShown) {
        warningShown = true;
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
        logoutTimer = createTimer(() => {
          window.dispatchEvent(new CustomEvent(SESSION_TIMEOUT));
        }, LOGOUT_TIMER);
      }
    }
  }
}

export async function renewOktaToken(oktaAuth: OktaAuth) {
  if (isRenewingToken) {
    return;
  }

  isRenewingToken = true;
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

      // Reset the warning flag since token was successfully renewed
      warningShown = false;
    }
  } catch {
    // failed to renew access token.
  } finally {
    isRenewingToken = false;
  }
}
