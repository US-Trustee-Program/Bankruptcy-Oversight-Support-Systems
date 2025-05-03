import { getLoginProviderFromEnv } from './login-library';
import { MockLogout } from './providers/mock/MockLogout';
import { OktaLogout } from './providers/okta/OktaLogout';
import { OktaProvider } from './providers/okta/OktaProvider';
import { SessionEnd } from './SessionEnd';

export function Logout() {
  const provider = getLoginProviderFromEnv();
  let providerComponent;
  switch (provider) {
    case 'mock':
      providerComponent = <MockLogout />;
      break;
    case 'okta':
      providerComponent = (
        <OktaProvider>
          <OktaLogout />
        </OktaProvider>
      );
      break;
    default:
      providerComponent = <SessionEnd />;
  }

  return providerComponent;
}
