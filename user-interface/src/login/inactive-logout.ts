import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import { redirectTo } from '@/lib/hooks/UseCamsNavigator';
import getAppConfiguration from '@/configuration/appConfiguration';

const POLLING_INTERVAL = 60000; // milliseconds
const TIMEOUT_MINUTES = getAppConfiguration().inactiveTimeout ?? 30;
const TIMEOUT = TIMEOUT_MINUTES * 60 * 1000;
export const WARNING_THRESHOLD = 60 * 1000; // 60 seconds

// Custom event names
export const SESSION_TIMEOUT = 'session-timeout';

// Module-level state
let warningEmitted = false;

export function resetLastInteraction() {
  LocalStorage.setLastInteraction(Date.now());
  warningEmitted = false;
}

export function checkForInactivity() {
  const now = Date.now();
  const lastInteraction = LocalStorage.getLastInteraction();

  if (!lastInteraction) {
    logout();
    return;
  }

  const timeElapsed = now - lastInteraction;
  const timeUntilTimeout = TIMEOUT - timeElapsed;

  // Emit warning event if within threshold
  if (timeUntilTimeout <= WARNING_THRESHOLD && timeUntilTimeout > 0) {
    if (!warningEmitted) {
      window.dispatchEvent(new CustomEvent(SESSION_TIMEOUT));
      warningEmitted = true;
    }
  }

  // Logout if timeout exceeded
  if (timeUntilTimeout <= 0) {
    logout();
  }
}

export function logout() {
  document.body.removeEventListener('click', resetLastInteraction);
  document.body.removeEventListener('keypress', resetLastInteraction);

  const { host, protocol } = window.location;
  const logoutUri = protocol + '//' + host + LOGOUT_PATH;
  redirectTo(logoutUri);
}

export function initializeInactiveLogout() {
  setInterval(checkForInactivity, POLLING_INTERVAL);
  document.body.addEventListener('click', resetLastInteraction);
  document.body.addEventListener('keypress', resetLastInteraction);
}
