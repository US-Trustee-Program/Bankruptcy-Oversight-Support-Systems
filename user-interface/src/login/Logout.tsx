import { AzureLogout } from './providers/azure/AzureLogout';
import {
  getLoginProviderFromEnv,
  LOGIN_LOCAL_STORAGE_ACK,
  LOGIN_LOCAL_STORAGE_USER_KEY,
} from './login-helpers';
import { MockLogout } from './providers/mock/MockLogout';
import { SessionEnd } from './SessionEnd';

export function Logout() {
  if (window.localStorage) {
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_USER_KEY);
    window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_ACK);
  }
  const provider = getLoginProviderFromEnv();
  let providerComponent;
  switch (provider) {
    case 'azure':
      providerComponent = <AzureLogout />;
      break;
    case 'mock':
      providerComponent = <MockLogout />;
      break;
    default:
      providerComponent = <SessionEnd />;
  }

  return providerComponent;
}
