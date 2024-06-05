import { PublicClientApplication } from '@azure/msal-browser';
import { getMsalConfig } from './authConfig';

export function getConfig() {
  // TODO: Maybe rename to non MSAL specific name, like "CAMS_LOGIN_PROVIDER_CONFIG"
  return JSON.parse(import.meta.env['CAMS_MSAL_CONFIG']);
}

export function msalInstance() {
  const config = getConfig();
  return new PublicClientApplication(getMsalConfig(config.auth, config.cache));
}
