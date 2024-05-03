import React, { PropsWithChildren, useEffect, useState } from 'react';
import AzureLoginProvider from './providers/azure/AzureLoginProvider';
import { AccessDenied } from './AccessDenied';
import MockAuthProvider from '@/login/providers/mock/MockAuthProvider';
import { Session } from './Session';
import { AuthorizedUseOnlyGate } from './AuthorizedUseOnlyGate';
import OpenIdProvider from './providers/openId/OpenIdProvider';
import {
  CamsUser,
  environmentVariableName,
  getLoginProviderTypeFromEnv,
  LOCAL_STORAGE_USER_KEY,
  LoginProviderType,
} from './login-helpers';

export type LoginProviderProps = PropsWithChildren & {
  provider?: LoginProviderType;
};

export default function LoginProvider(props: LoginProviderProps): React.ReactNode {
  const [isLocalStorageRead, setIsLocalStorageRead] = useState<boolean>(false);
  const [acknowledged, setAcknowledged] = useState<boolean>(false);
  const [user, setUser] = useState<CamsUser | null>(null);

  useEffect(() => {
    if (window.localStorage) {
      const userJson = window.localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (userJson) {
        setUser(JSON.parse(userJson));
      }
    }
    setIsLocalStorageRead(true);
  }, []);

  if (!isLocalStorageRead) return <></>;

  if (!user && !acknowledged) {
    return <AuthorizedUseOnlyGate onConfirm={() => setAcknowledged(true)} />;
  }

  const provider = props.provider?.toString().toLowerCase() ?? getLoginProviderTypeFromEnv();

  let providerComponent;
  switch (provider) {
    case 'azure':
      providerComponent = <AzureLoginProvider>{props.children}</AzureLoginProvider>;
      break;
    case 'openid':
      providerComponent = <OpenIdProvider>{props.children}</OpenIdProvider>;
      break;
    case 'mock':
      providerComponent = <MockAuthProvider user={user}>{props.children}</MockAuthProvider>;
      break;
    case 'none':
      providerComponent = <Session user={{ name: 'Super User' }}>{props.children}</Session>;
      break;
    default:
      // TODO: Log this to app insights.
      console.error(
        'Login provider not specified or not a valid option.',
        `Valid options are 'azure' | 'openid' | 'mock' | 'none'.`,
        `Build variable name: '${environmentVariableName}'.`,
        `Build variable value: '${provider}'.`,
      );
      providerComponent = <AccessDenied />;
  }

  return providerComponent;
}
