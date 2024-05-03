import { LogLevel } from '@azure/msal-browser';

// TODO: Maybe just merge all this code into the AzureLoginProvider component...
export interface AuthConfig {
  clientId: string;
  authority: string;
  redirectUri: string;
}

export interface CacheConfig {
  cacheLocation: string;
  storeAuthStateInCookie: boolean;
}

const partialMsalConfig = {
  auth: { clientId: '', authority: '', redirectUri: '' },
  cache: { cacheLocation: '', storeAuthStateInCookie: false },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string, containsPii: boolean) => {
        if (containsPii) {
          return;
        }
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            return;
          case LogLevel.Info:
            // console.info(message);
            return;
          case LogLevel.Verbose:
            // console.debug(message);
            return;
          case LogLevel.Warning:
            console.warn(message);
            return;
          default:
            return;
        }
      },
    },
  },
};

/**
 * Configuration object to be passed to MSAL instance on creation.
 * For a full list of MSAL.js configuration parameters, visit:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/lib/msal-browser/docs/configuration.md
 */
export function getMsalConfig(authConfig: AuthConfig, cacheConfig: CacheConfig) {
  const msalConfig = { ...partialMsalConfig };
  msalConfig.auth = authConfig;
  msalConfig.cache = cacheConfig;
  return msalConfig;
}

/**
 * Scopes you add here will be prompted for user consent during sign-in.
 * By default, MSAL.js will add OIDC scopes (openid, profile, email) to any login request.
 * For more information about OIDC scopes, visit:
 * https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-permissions-and-consent#openid-connect-scopes
 */
export function getLoginRequest(scopes: string[]) {
  return { scopes };
}
