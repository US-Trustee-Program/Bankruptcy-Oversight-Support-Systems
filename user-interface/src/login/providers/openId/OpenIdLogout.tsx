import { useMsal } from '@azure/msal-react';

export function OpenIdLogout() {
  const { instance } = useMsal();
  async function logout() {
    await instance.initialize();
    await instance.logoutRedirect({
      postLogoutRedirectUri: '/logout',
    });
  }
  logout();
  return <div>Logging out</div>;
}
