export const LOGIN_PROVIDER_ENV_VAR_NAME = 'CAMS_LOGIN_PROVIDER';
export const LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME = 'CAMS_LOGIN_PROVIDER_CONFIG';
export const LOGIN_LOCAL_STORAGE_SESSION_KEY = 'cams:session';
export const LOGIN_LOCAL_STORAGE_ACK_KEY = 'cams:ack';

export const LOGIN_PATH = '/login';
export const LOGIN_CONTINUE_PATH = '/login-continue';
export const LOGIN_SUCCESS_PATH = '/';
export const LOGOUT_PATH = '/logout';
export const LOGOUT_SESSION_END_PATH = '/session-end';
export const AUTHENTICATION_PATHS = [
  LOGIN_PATH,
  LOGIN_CONTINUE_PATH,
  LOGOUT_PATH,
  LOGOUT_SESSION_END_PATH,
];

export type CamsUser = {
  name: string;
};

export type CamsSession = {
  user: CamsUser | null;
  provider: LoginProvider | null;
};

export type LoginProvider = 'okta' | 'mock' | 'none';

export function isLoginProviderType(provider: string): provider is LoginProvider {
  switch (provider) {
    case 'okta':
    case 'mock':
    case 'none':
      return true;
    default:
      return false;
  }
}

export function getLoginProviderFromEnv(): string {
  const value = import.meta.env[LOGIN_PROVIDER_ENV_VAR_NAME];
  if (value) return value.toLowerCase();
  return 'unknown';
}

export function getLoginConfigurationFromEnv<T = unknown>(): T {
  try {
    const configJson = import.meta.env[LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME];
    if (!configJson) throw new Error('Missing authentication configuration');
    const config = JSON.parse(configJson);
    return config;
  } catch (e) {
    throw e as Error;
  }
}

export function getSessionfromLocalStorage(provider: LoginProvider) {
  try {
    let session: CamsSession | null = null;
    if (window.localStorage) {
      const sessionJson = window.localStorage.getItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
      if (sessionJson) {
        session = JSON.parse(sessionJson);
        if (session?.provider !== provider) {
          window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
          session = null;
        }
      }
    }
    return session;
  } catch (e) {
    return null;
  }
}
