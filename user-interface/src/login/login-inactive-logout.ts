import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';

const POLLING_INTERVAL = 20000; // milliseconds
const TIMEOUT = 15000;

export function resetLastInteraction() {
  LocalStorage.setLastInteraction(Date.now());
}

export function checkForInactivity() {
  const now = Date.now();
  const lastInteraction = LocalStorage.getLastInteraction();
  if (!lastInteraction || now > lastInteraction + TIMEOUT) {
    const { host, protocol } = window.location;
    const logoutUri = protocol + '//' + host + LOGOUT_PATH;
    window.location.assign(logoutUri);
  }
}

export function initializeInactiveLogout() {
  setInterval(checkForInactivity, POLLING_INTERVAL);
  document.body.addEventListener('click', resetLastInteraction);
}
