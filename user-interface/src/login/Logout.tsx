import { AzureLogout } from './providers/azure/AzureLogout';
import { getLoginProviderFromEnv } from './login-helpers';
import { MockLogout } from './providers/mock/MockLogout';
import { SessionEnd } from './SessionEnd';
import { OktaLogout } from './providers/okta/OktaLogout';

export function Logout() {
  const provider = getLoginProviderFromEnv();
  let providerComponent;
  switch (provider) {
    case 'azure':
      providerComponent = <AzureLogout />;
      break;
    case 'okta':
      providerComponent = <OktaLogout />;
      break;
    case 'mock':
      providerComponent = <MockLogout />;
      break;
    default:
      providerComponent = <SessionEnd />;
  }

  return providerComponent;
}
