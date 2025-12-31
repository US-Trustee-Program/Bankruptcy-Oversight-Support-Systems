import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import { redirectTo } from '@/lib/hooks/UseCamsNavigator';
import getAppConfiguration from '@/configuration/appConfiguration';

export const SIXTY_SECONDS = 60;
export const HEARTBEAT = 1000 * SIXTY_SECONDS;
export const SESSION_TIMEOUT = 'session-timeout';
export const AUTH_EXPIRY_WARNING = 'auth-expiry-warning';
export const SAFE_LIMIT = 300;
export const LOGOUT_TIMER = 1000 * SIXTY_SECONDS;

const TIMEOUT_MINUTES = getAppConfiguration().inactiveTimeout ?? 30;
const TIMEOUT = TIMEOUT_MINUTES * SIXTY_SECONDS * 1000;

export interface Timer {
  id: number;
  clear: () => void;
}

export function createTimer(callback: () => void, interval: number): Timer {
  const id = window.setInterval(callback, interval);
  return {
    id,
    clear: () => window.clearInterval(id),
  };
}

// Stateless helper functions
export function isUserActive(
  lastInteraction: number | null,
  heartbeatInterval: number = HEARTBEAT,
): boolean {
  if (!lastInteraction) {
    return false;
  }
  const now = Date.now();
  const timeElapsed = now - lastInteraction;
  return timeElapsed < heartbeatInterval;
}

export function getTimeUntilTimeout(
  lastInteraction: number | null,
  timeout: number = TIMEOUT,
): number {
  if (!lastInteraction) {
    return 0;
  }
  const now = Date.now();
  const timeElapsed = now - lastInteraction;
  return timeout - timeElapsed;
}

export function shouldShowWarning(
  timeUntilTimeout: number,
  warningThreshold: number = SIXTY_SECONDS * 1000,
): boolean {
  return timeUntilTimeout <= warningThreshold && timeUntilTimeout > 0;
}

export function shouldLogout(timeUntilTimeout: number): boolean {
  return timeUntilTimeout <= 0;
}

export function resetLastInteraction(): void {
  LocalStorage.setLastInteraction(Date.now());
}

export function getLastInteraction(): number | null {
  return LocalStorage.getLastInteraction();
}

export function logout(): void {
  const { host, protocol } = window.location;
  const logoutUri = protocol + '//' + host + LOGOUT_PATH;
  redirectTo(logoutUri);
}
