import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import { redirectTo } from '@/lib/hooks/UseCamsNavigator';
import getAppConfiguration from '@/configuration/appConfiguration';

const POLLING_INTERVAL = 60000; // milliseconds
const TIMEOUT_MINUTES = getAppConfiguration().inactiveTimeout ?? 30;
const TIMEOUT = TIMEOUT_MINUTES * 60 * 1000;

export function resetLastInteraction() {
  LocalStorage.setLastInteraction(Date.now());
}

export function checkForInactivity() {
  const now = Date.now();
  const lastInteraction = LocalStorage.getLastInteraction();
  if (!lastInteraction || now > lastInteraction + TIMEOUT) {
    document.body.removeEventListener('click', resetLastInteraction);
    document.body.removeEventListener('keypress', resetLastInteraction);

    const { host, protocol } = window.location;
    const logoutUri = protocol + '//' + host + LOGOUT_PATH;
    redirectTo(logoutUri);
  }
}

export function initializeInactiveLogout() {
  setInterval(checkForInactivity, POLLING_INTERVAL);
  document.body.addEventListener('click', resetLastInteraction);
  document.body.addEventListener('keypress', resetLastInteraction);
}
