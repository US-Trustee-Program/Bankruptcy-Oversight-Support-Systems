import { isCamsApi } from '@/configuration/apiConfiguration';
import { LOGOUT_PATH } from './login-library';

export async function http401Hook(response: Response) {
  if (response.status === 401 && isCamsApi(response.url)) {
    const { host, protocol } = window.location;
    const logoutUri = protocol + '//' + host + LOGOUT_PATH;
    window.location.assign(logoutUri);
  }
}
