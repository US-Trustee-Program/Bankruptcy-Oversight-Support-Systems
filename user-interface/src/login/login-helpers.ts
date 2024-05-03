export const environmentVariableName = 'CAMS_LOGIN_PROVIDER';

export const LOCAL_STORAGE_USER_KEY = 'cams:user';

export type CamsUser = {
  name: string;
};

export type LoginProviderType = 'azure' | 'openid' | 'mock' | 'none';

export function isLoginProviderType(providerType: string): providerType is LoginProviderType {
  switch (providerType) {
    case 'azure':
    case 'openid':
    case 'mock':
    case 'none':
      return true;
    default:
      return false;
  }
}

export function getLoginProviderTypeFromEnv(): string {
  return import.meta.env[environmentVariableName].toLowerCase();
}
