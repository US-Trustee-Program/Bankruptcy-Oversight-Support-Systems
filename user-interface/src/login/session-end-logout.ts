import LocalStorage from '@/lib/utils/local-storage';
import { LOGOUT_PATH } from './login-library';
import { redirectTo } from '@/lib/hooks/UseCamsNavigator';
import { CamsSession } from '@common/cams/session';
import DateHelper from '@common/date-helper';

export function checkForSessionEnd() {
  const session = LocalStorage.getSession();
  if (!session || session.expires <= DateHelper.nowInSeconds()) {
    const { host, protocol } = window.location;
    const logoutUri = protocol + '//' + host + LOGOUT_PATH;
    redirectTo(logoutUri);
  }
}

export function initializeSessionEndLogout(session: CamsSession) {
  setInterval(checkForSessionEnd, Math.floor(session.expires - DateHelper.nowInSeconds()) * 1000);
}
