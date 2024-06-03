export const LOGIN_PROVIDER_ENV_VAR_NAME = 'CAMS_LOGIN_PROVIDER';
export const LOGIN_LOCAL_STORAGE_USER_KEY = 'cams:user';
export const LOGIN_LOCAL_STORAGE_ACK_KEY = 'cams:ack';
export const LOGIN_LOCAL_STORAGE_PROVIDER_KEY = 'cams:provider';

export const LOGIN_PATH = '/login';
export const LOGOUT_PATH = '/logout';

export type CamsUser = {
  name: string;
};

export type LoginProvider = 'azure' | 'mock' | 'none';

export function isLoginProviderType(provider: string): provider is LoginProvider {
  switch (provider) {
    case 'azure':
    case 'mock':
    case 'none':
      return true;
    default:
      return false;
  }
}

export function getLoginProviderFromEnv(): string {
  return import.meta.env[LOGIN_PROVIDER_ENV_VAR_NAME].toLowerCase();
}
