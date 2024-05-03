import { useEffect, useState } from 'react';
import { AzureLogout } from './providers/azure/AzureLogout';
import { OpenIdLogout } from './providers/openId/OpenIdLogout';
import { AccessDenied } from './AccessDenied';
import { getLoginProviderTypeFromEnv } from './login-helpers';

export function Logout() {
  const [isCamsUserRemoved, setIsCamsUserRemoved] = useState<boolean>(false);
  const provider = getLoginProviderTypeFromEnv();

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
    case 'openid':
      providerComponent = <OpenIdLogout />;
      break;
    case 'mock':
    case 'none':
    default:
      // TODO: Add a friendler "logged out" message component that all logout workflows terminate into.
      providerComponent = <AccessDenied />;
  }

  return providerComponent;
}
