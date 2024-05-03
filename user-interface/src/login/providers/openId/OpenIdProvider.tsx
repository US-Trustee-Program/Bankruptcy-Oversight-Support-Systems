import { InteractionStatus, PublicClientApplication } from '@azure/msal-browser';
import { getLoginRequest, getMsalConfig } from '@/login/providers/azure/authConfig';
import { PropsWithChildren } from 'react';
import {
  AuthenticatedTemplate,
  MsalProvider,
  UnauthenticatedTemplate,
  useIsAuthenticated,
  useMsal,
} from '@azure/msal-react';
import { AccessDenied } from '@/login/AccessDenied';
import { OpenIdSessionMap } from './OpenIdSessionMap';

function getConfig() {
  // TODO: Maybe rename to non MSAL specific name, like "CAMS_LOGIN_PROVIDER_CONFIG"
  return JSON.parse(import.meta.env['CAMS_MSAL_CONFIG']);
}

const msalInstance = () => {
  const config = getConfig();
  return new PublicClientApplication(getMsalConfig(config.auth, config.cache));
};

export type OpenIdProviderProps = PropsWithChildren;

export default function OpenIdProvider(props: OpenIdProviderProps) {
  return (
    <MsalProvider instance={msalInstance()}>
      <UnauthenticatedTemplate>
        <OpenIdLogin></OpenIdLogin>
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <OpenIdSessionMap>{props.children}</OpenIdSessionMap>
      </AuthenticatedTemplate>
    </MsalProvider>
  );
}

// Is this actually different than with Azure AD?
function OpenIdLogin() {
  const config = getConfig();
  const loginRequest = getLoginRequest(config.scopes);
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  if (inProgress === InteractionStatus.None && !isAuthenticated) {
    instance.initialize().then(() => {
      instance.loginRedirect(loginRequest);
    });
  }

  // Try to log in if we aren't
  if (inProgress !== InteractionStatus.None) return <div>Logging in</div>;

  // Otherwise stop.
  return <AccessDenied />;
}
