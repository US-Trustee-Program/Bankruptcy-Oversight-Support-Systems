import { useEffect, useState } from 'react';
import { AzureLogout } from './providers/azure/AzureLogout';
import { AccessDenied } from './AccessDenied';
import { getLoginProviderFromEnv } from './login-helpers';
import { MockLogout } from './providers/mock/MockLogout';

export function Logout() {
  const [isCamsUserRemoved, setIsCamsUserRemoved] = useState<boolean>(false);
  const provider = getLoginProviderFromEnv();

  useEffect(() => {
    // TODO: Remove the cams user from local storage.
    setIsCamsUserRemoved(true);
  }, []);
  if (!isCamsUserRemoved) return <></>;

  let providerComponent;
  switch (provider) {
    case 'azure':
      providerComponent = <AzureLogout />;
      break;
    case 'mock':
      providerComponent = <MockLogout />;
      break;
    case 'none':
    default:
      // TODO: Add a friendler "logged out" message component that all logout workflows terminate into.
      providerComponent = <AccessDenied />;
  }

  return providerComponent;
}
