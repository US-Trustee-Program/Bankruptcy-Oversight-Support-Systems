import {
  AuthenticatedTemplate,
  MsalProvider,
  UnauthenticatedTemplate,
  useMsal,
} from '@azure/msal-react';
import { msalInstance } from './azure-helpers';
import { SessionEnd } from '@/login/SessionEnd';
import { LOGOUT_PATH } from '@/login/login-helpers';

export function AzureLogout() {
  return (
    <MsalProvider instance={msalInstance()}>
      <UnauthenticatedTemplate>
        <SessionEnd />
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <AzureLogoutRedirect />
      </AuthenticatedTemplate>
    </MsalProvider>
  );
}

function AzureLogoutRedirect() {
  const { instance } = useMsal();
  async function logout() {
    await instance.initialize();
    await instance.logoutRedirect({
      postLogoutRedirectUri: LOGOUT_PATH,
    });
  }
  logout();
  return <></>;
}
