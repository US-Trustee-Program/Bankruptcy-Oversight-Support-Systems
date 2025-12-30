import OktaAuth, { UserClaims } from '@okta/okta-auth-js';
import LocalStorage from '@/lib/utils/local-storage';
import DateHelper from '@common/date-helper';
import Api2 from '@/lib/models/api2';
import { initializeSessionEndLogout } from '@/login/session-end-logout';

export const AUTH_EXPIRY_WARNING = 'auth-expiry-warning';
export const SIXTY_SECONDS = 60;

const SAFE_LIMIT = 300;
const HEARTBEAT = 1000 * SIXTY_SECONDS * 5;
const LOGOUT_TIMER = 1000 * SIXTY_SECONDS;

class SessionTimerController {
  private heartbeatIntervalId: number | null = null;
  private logoutTimerIntervalId: number | null = null;
  private warningShown = false;
  private isRenewingToken = false;

  startHeartbeat(callback: () => void): void {
    this.clearHeartbeat();
    this.heartbeatIntervalId = window.setInterval(callback, HEARTBEAT);
  }

  clearHeartbeat(): void {
    if (this.heartbeatIntervalId !== null) {
      window.clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  startLogoutTimer(callback: () => void): void {
    this.clearLogoutTimer();
    this.logoutTimerIntervalId = window.setInterval(callback, LOGOUT_TIMER);
  }

  clearLogoutTimer(): void {
    if (this.logoutTimerIntervalId !== null) {
      window.clearInterval(this.logoutTimerIntervalId);
      this.logoutTimerIntervalId = null;
    }
  }

  setWarningShown(shown: boolean): void {
    this.warningShown = shown;
  }

  hasWarningBeenShown(): boolean {
    return this.warningShown;
  }

  setRenewingToken(renewing: boolean): void {
    this.isRenewingToken = renewing;
  }

  isTokenRenewalInProgress(): boolean {
    return this.isRenewingToken;
  }

  reset(): void {
    this.clearHeartbeat();
    this.clearLogoutTimer();
    this.warningShown = false;
    this.isRenewingToken = false;
  }
}

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
      // if close to expiry and user active, renew token
      await renewOktaToken(oktaAuth);
      sessionTimerController.clearLogoutTimer();
    } else {
      // if close to expiry and user inactive, show warning once
      if (!sessionTimerController.hasWarningBeenShown()) {
        sessionTimerController.setWarningShown(true);
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRY_WARNING));
        sessionTimerController.startLogoutTimer(() => initializeSessionEndLogout(session));
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
