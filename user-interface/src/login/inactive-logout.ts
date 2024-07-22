import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';

const POLLING_INTERVAL = 60000; // milliseconds
const TIMEOUT_MINUTES = import.meta.env['CAMS_INACTIVE_TIMEOUT'] ?? 30;
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
    window.location.assign(logoutUri);
  }
}

export function initializeInactiveLogout() {
  setInterval(checkForInactivity, POLLING_INTERVAL);
  document.body.addEventListener('click', resetLastInteraction);
  document.body.addEventListener('keypress', resetLastInteraction);
}
