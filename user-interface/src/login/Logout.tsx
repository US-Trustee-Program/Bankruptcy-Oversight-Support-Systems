import { AzureLogout } from './providers/azure/AzureLogout';
import { getLoginProviderFromEnv } from './login-helpers';
import { MockLogout } from './providers/mock/MockLogout';
import { SessionEnd } from './SessionEnd';

export function Logout() {
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
