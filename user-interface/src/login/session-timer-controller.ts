import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import { redirectTo } from '@/lib/hooks/UseCamsNavigator';

export const SIXTY_SECONDS = 60;
export const HEARTBEAT = 1000 * SIXTY_SECONDS;
export const SESSION_TIMEOUT = 'session-timeout';
export const AUTH_EXPIRY_WARNING = 'auth-expiry-warning';
export const SAFE_LIMIT = 300;

const LOGOUT_TIMER = 1000 * SIXTY_SECONDS;

export class SessionTimerController {
  private heartbeatIntervalId: number | null = null;
  private logoutTimerIntervalId: number | null = null;
  private warningShown = false;
  private isRenewingToken = false;

  startHeartbeat(callback: () => void): void {
    console.log('startHearbeat');
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

  resetLastInteraction(): void {
    LocalStorage.setLastInteraction(Date.now());
  }

  logout(): void {
    document.body.removeEventListener('click', this.resetLastInteraction);
    document.body.removeEventListener('keypress', this.resetLastInteraction);

    const { host, protocol } = window.location;
    const logoutUri = protocol + '//' + host + LOGOUT_PATH;
    redirectTo(logoutUri);
  }
}
