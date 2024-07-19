import { describe } from 'vitest';
import {
  getAuthIssuerFromEnv,
  getLoginConfigurationFromEnv,
  getLoginProviderFromEnv,
  isLoginProviderType,
  LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME,
  LOGIN_PROVIDER_ENV_VAR_NAME,
} from './login-library';

const providerTypes = ['okta', 'mock', 'none'];
const bogusType = 'bogus';

describe('Login library', () => {
  describe('isLoginProviderType', () => {
    test('should validate if a string is a provider type', () => {
      providerTypes.forEach((key) => {
        expect(isLoginProviderType(key)).toBeTruthy();
      });

      expect(isLoginProviderType(bogusType)).toBeFalsy();
    });
  });

  describe('getLoginProviderFromEnv', () => {
    test('should get the provider type from the environment', () => {
      providerTypes.forEach((key) => {
        vi.stubEnv(LOGIN_PROVIDER_ENV_VAR_NAME, key);
        expect(getLoginProviderFromEnv()).toEqual(key);
      });

      vi.stubEnv(LOGIN_PROVIDER_ENV_VAR_NAME, bogusType);
      expect(getLoginProviderFromEnv()).toEqual(bogusType);

      vi.stubEnv(LOGIN_PROVIDER_ENV_VAR_NAME, '');
      expect(getLoginProviderFromEnv()).toEqual('');
    });
  });

  describe('getLoginConfigurationFromEnv', () => {
    test('should get the provider configuration from the environment', () => {
      const functionExpectedToThrow = () => {
        getLoginConfigurationFromEnv();
      };

      vi.stubEnv(LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME, '');
      expect(functionExpectedToThrow).toThrow();

      const expectedConfiguration = { url: 'http://localhost/' };
      vi.stubEnv(LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME, 'url=http://localhost/');
      expect(getLoginConfigurationFromEnv()).toEqual(expectedConfiguration);
    });
  });

  describe('getAuthIssuerFromEnv', () => {
    test('should get the auth issuer from the environment', () => {
      const expectedIssuer = 'http://localhost/';
      vi.stubEnv(LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME, `issuer=${expectedIssuer}`);
      const issuer = getAuthIssuerFromEnv();
      expect(issuer).toEqual(expectedIssuer);
    });

    test('should return undefined for the issuer from the environment if not set', () => {
      vi.stubEnv(LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME, `foo=bar`);
      const issuer = getAuthIssuerFromEnv();
      expect(issuer).toBeUndefined();
    });
  });
});
