export const LOGIN_PROVIDER_ENV_VAR_NAME = 'CAMS_LOGIN_PROVIDER';
export const LOGIN_LOCAL_STORAGE_SESSION_KEY = 'cams:session';
export const LOGIN_LOCAL_STORAGE_ACK_KEY = 'cams:ack';

export const LOGIN_PATH = '/login';
export const LOGIN_CONTINUE_PATH = '/login-continue';
export const LOGOUT_PATH = '/logout';

export type CamsUser = {
  name: string;
};

export type CamsSession = {
  user: CamsUser | null;
  provider: LoginProvider;
};

export type LoginProvider = 'azure' | 'okta' | 'mock' | 'none';

export function isLoginProviderType(provider: string): provider is LoginProvider {
  switch (provider) {
    case 'azure':
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
