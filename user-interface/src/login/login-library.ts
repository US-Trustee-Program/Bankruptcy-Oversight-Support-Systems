export const LOGIN_PROVIDER_ENV_VAR_NAME = 'CAMS_LOGIN_PROVIDER';
export const LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME = 'CAMS_LOGIN_PROVIDER_CONFIG';

export const LOGIN_PATH = '/login';
export const LOGIN_CONTINUE_PATH = '/login-continue';
export const LOGIN_SUCCESS_PATH = '/';
export const LOGOUT_PATH = '/logout';
export const LOGOUT_SESSION_END_PATH = '/session-end';
export const LOGIN_PATHS = [LOGIN_PATH, LOGIN_CONTINUE_PATH, LOGOUT_PATH, LOGOUT_SESSION_END_PATH];

export function getLoginProviderFromEnv(): string {
  const value = import.meta.env[LOGIN_PROVIDER_ENV_VAR_NAME];
  return value.toLowerCase();
}

export function getAuthIssuerFromEnv(): string | undefined {
  const config = getLoginConfigurationFromEnv<object>();
  return 'issuer' in config && typeof config.issuer === 'string' ? config.issuer : undefined;
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

export type LoginProvider = 'okta' | 'mock' | 'none';

export function isLoginProviderType(provider: string): provider is LoginProvider {
  return ['okta', 'mock', 'none'].includes(provider);
}
