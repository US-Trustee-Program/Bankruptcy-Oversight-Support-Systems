import { LOGOUT_PATH } from './login-library';

export async function inactiveLogoutHook() {
  const someTimoutCondition = true;
  if (someTimoutCondition) {
    const { host, protocol } = window.location;
    const logoutUri = protocol + '//' + host + LOGOUT_PATH;
    window.location.assign(logoutUri);
  }
}
