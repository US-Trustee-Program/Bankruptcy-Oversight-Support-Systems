import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import { redirectTo } from '@/lib/hooks/UseCamsNavigator';
import { CamsSession } from '@common/cams/session';
import DateHelper from '@common/date-helper';

export function checkForSessionEnd() {
  // Guard against window being undefined (e.g., during test teardown)
  if (typeof window === 'undefined') {
    return;
  }

  const session = LocalStorage.getSession();
  if (!session || session.expires <= DateHelper.nowInSeconds()) {
    const { host, protocol } = window.location;
    const logoutUri = protocol + '//' + host + LOGOUT_PATH;
    redirectTo(logoutUri);
  }
}

// setInterval delays beyond this overflow Node/browser's 32-bit signed timer and
// silently clamp to 1ms, turning a single scheduled check into a tight busy-loop.
const MAX_32_BIT_DELAY_MS = 2_147_483_647;

export function initializeSessionEndLogout(session: CamsSession) {
  const delayMs = Math.floor(session.expires - DateHelper.nowInSeconds()) * 1000;
  setInterval(checkForSessionEnd, Math.min(delayMs, MAX_32_BIT_DELAY_MS));
}
