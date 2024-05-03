import { PropsWithChildren } from 'react';
import {
  InteractionRequiredAuthError,
  InteractionStatus,
  PublicClientApplication,
} from '@azure/msal-browser';
import {
  AuthenticatedTemplate,
  MsalProvider,
  UnauthenticatedTemplate,
  useIsAuthenticated,
  useMsal,
} from '@azure/msal-react';
import { AccessDenied } from '@/login/AccessDenied';
import { getLoginRequest, getMsalConfig } from '@/login/providers/azure/authConfig';
import { AzureSessionMap } from './AzureSessionMap';

function getConfig() {
  // TODO: Maybe rename to non MSAL specific name, like "CAMS_LOGIN_PROVIDER_CONFIG"
  return JSON.parse(import.meta.env['CAMS_MSAL_CONFIG']);
}

export async function callMsGraph(accessToken: string) {
  const config = getConfig();
  const headers = new Headers();
  const bearer = `Bearer ${accessToken}`;

  headers.append('Authorization', bearer);

  const options = {
    method: 'GET',
    headers: headers,
  };

  return fetch(config.graphMeEndpoint, options)
    .then((response) => response.json())
    .catch((error) => console.log(error));
}

const msalInstance = () => {
  const config = getConfig();
  return new PublicClientApplication(getMsalConfig(config.auth, config.cache));
};

export type AzureLoginProviderProps = PropsWithChildren;

export default function AzureLoginProvider(props: AzureLoginProviderProps) {
  return (
    <MsalProvider instance={msalInstance()}>
      <UnauthenticatedTemplate>
        <AzureLogin></AzureLogin>
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <AzureSessionMap>{props.children}</AzureSessionMap>
      </AuthenticatedTemplate>
    </MsalProvider>
  );
}

function AzureLogin() {
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

// TODO: Get this to work when we need to query the graph API.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LoadProfile(props: PropsWithChildren) {
  const config = getConfig();
  const loginRequest = getLoginRequest(config.scopes);
  const { instance, accounts, inProgress } = useMsal();

  async function requestProfileData() {
    const accessTokenRequest = {
      ...loginRequest,
      account: accounts[0],
    };
    if (inProgress === InteractionStatus.None) {
      instance
        .acquireTokenSilent(accessTokenRequest)
        .then((response) => {
          callMsGraph(response.accessToken).then((_response) => {
            // Handle the graph api response.
          });
        })
        .catch((error) => {
          if (error instanceof InteractionRequiredAuthError) {
            // user needs to reauthenticate
            msalInstance().acquireTokenRedirect(accessTokenRequest);
          } else {
            // TODO: Log to app insights.
            console.error(error);
          }
        });
    }
  }
  requestProfileData();
  return <>{props.children}</>;
}
