import { useMsal } from '@azure/msal-react';

export function AzureLogout() {
  const { instance } = useMsal();
  async function logout() {
    await instance.initialize();
    await instance.logoutRedirect({
      postLogoutRedirectUri: '/logout',
    });
  }
  // TODO: Do this better. We want to render the termination once the redirection is complete.
  logout();
  return <div>Logging out</div>;
}
