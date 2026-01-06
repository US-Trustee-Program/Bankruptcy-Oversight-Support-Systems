import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import { redirectTo } from '@/lib/hooks/UseCamsNavigator';
import getAppConfiguration from '@/configuration/appConfiguration';

export const SESSION_TIMEOUT = 'session-timeout';
export const AUTH_EXPIRY_WARNING = 'auth-expiry-warning';
export const SIXTY_SECONDS = 60;
export const HEARTBEAT = 1000 * SIXTY_SECONDS;
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
export function isUserActive(lastInteraction: number | null): boolean {
  if (!lastInteraction) {
    return false;
  }

  const now = Date.now();
  const timeElapsed = now - lastInteraction;
  return timeElapsed < TIMEOUT - LOGOUT_TIMER;
}

export function resetLastInteraction(): void {
  LocalStorage.setLastInteraction(Date.now());
}

export function getLastInteraction(): number | null {
  return LocalStorage.getLastInteraction();
}

export function checkForInactivity() {
  const now = Date.now();
  const lastInteraction = getLastInteraction();

  if (!lastInteraction) {
    logout();
    return;
  }

  const timeElapsed = now - lastInteraction;
  const timeUntilTimeout = TIMEOUT - timeElapsed;

  if (timeUntilTimeout <= 0) {
    logout();
  }
}

export function logout(): void {
  const { host, protocol } = window.location;
  const logoutUri = protocol + '//' + host + LOGOUT_PATH;
  redirectTo(logoutUri);
}

let logoutCleanupHandler: (() => void) | null = null;

export function registerLogoutCleanupHandler(handler: () => void): void {
  logoutCleanupHandler = handler;
}

export function cancelPendingLogout(): void {
  resetLastInteraction();

  if (logoutCleanupHandler) {
    logoutCleanupHandler();
  }
}

export function initializeInteractionListeners() {
  document.body.addEventListener('click', resetLastInteraction);
  document.body.addEventListener('keypress', resetLastInteraction);
}
