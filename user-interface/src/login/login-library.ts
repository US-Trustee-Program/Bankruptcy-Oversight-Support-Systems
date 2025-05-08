import { keyValuesToRecord } from '@common/cams/utilities';
import getAppConfiguration from '@/configuration/appConfiguration';

export const LOGIN_PATH = '/login';
export const LOGIN_CONTINUE_PATH = '/login-continue';
export const LOGIN_SUCCESS_PATH = '/my-cases';
export const LOGIN_BASE_PATH = '/';
export const LOGOUT_PATH = '/logout';
export const LOGOUT_SESSION_END_PATH = '/session-end';
export const LOGIN_PATHS = [LOGIN_PATH, LOGIN_CONTINUE_PATH, LOGOUT_PATH, LOGOUT_SESSION_END_PATH];

export function getLoginProvider(): string {
  const value = getAppConfiguration().loginProvider?.toLowerCase();
  if (value === undefined) throw new Error('Missing authentication provider');
  return value;
}

export function getAuthIssuer(): string | undefined {
  const config = getLoginConfiguration<object>();
  return 'issuer' in config && typeof config.issuer === 'string' ? config.issuer : undefined;
}

export function getLoginConfiguration<T = unknown>(): T {
  try {
    const kvString = getAppConfiguration().loginProviderConfig;
    if (!kvString) throw new Error('Missing authentication configuration');
    return keyValuesToRecord(kvString) as T;
  } catch (e) {
    throw e as Error;
  }
}

export type LoginProvider = 'okta' | 'mock' | 'none';

export function isLoginProviderType(provider: string): provider is LoginProvider {
  return ['okta', 'mock', 'none'].includes(provider);
}
