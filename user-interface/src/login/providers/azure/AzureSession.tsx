import { PropsWithChildren } from 'react';
import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { Session } from '@/login/Session';
import { AccessDenied } from '@/login/AccessDenied';
import { CamsUser } from '@/login/login-helpers';

export function AzureSession(props: PropsWithChildren) {
  const { accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) {
    const user: CamsUser = { name: accounts[0].name ?? accounts[0].username };
    return <Session user={user}>{props.children}</Session>;
  } else {
    return <AccessDenied />;
  }
}
