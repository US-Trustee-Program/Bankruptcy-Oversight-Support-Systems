import OktaAuth, { UserClaims } from '@okta/okta-auth-js';
import LocalStorage from '@/lib/utils/local-storage';
import DateHelper from '@common/date-helper';
import Api2 from '@/lib/models/api2';
import { initializeSessionEndLogout } from '@/login/session-end-logout';
import {
  HEARTBEAT,
  SESSION_TIMEOUT,
  SessionTimerController,
} from '@/login/session-timer-controller';

export const AUTH_EXPIRY_WARNING = 'auth-expiry-warning';

const SAFE_LIMIT = 300;
const sessionTimerController = new SessionTimerController();

export function resetWarningShownFlag() {
  sessionTimerController.setWarningShown(false);
}

export function registerRenewOktaToken(oktaAuth: OktaAuth) {
  sessionTimerController.startHeartbeat(() => handleHeartbeat(oktaAuth));
}

export function getCamsUser(oktaUser: UserClaims | null) {
  return { id: oktaUser?.sub ?? 'UNKNOWN', name: oktaUser?.name ?? oktaUser?.email ?? 'UNKNOWN' };
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
      await renewOktaToken(oktaAuth);
      sessionTimerController.clearLogoutTimer();
    } else {
      if (!sessionTimerController.hasWarningBeenShown()) {
        sessionTimerController.setWarningShown(true);
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
        sessionTimerController.startLogoutTimer(() =>
          window.dispatchEvent(new CustomEvent(SESSION_TIMEOUT)),
        );
      }
    }
  }
}

export async function renewOktaToken(oktaAuth: OktaAuth) {
  if (sessionTimerController.isTokenRenewalInProgress()) {
    return;
  }

  sessionTimerController.setRenewingToken(true);
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

      // Reset the warning flag since token was successfully renewed
      sessionTimerController.setWarningShown(false);
    }
  } catch {
    // failed to renew access token.
  } finally {
    sessionTimerController.setRenewingToken(false);
  }
}
