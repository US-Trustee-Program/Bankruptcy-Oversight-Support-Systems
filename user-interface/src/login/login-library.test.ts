import { describe } from 'vitest';
import {
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
      expect(getLoginProviderFromEnv()).toEqual('unknown');
    });
  });

  describe('getLoginConfigurationFromEnv', () => {
    test('should get the provider configuration from the environment', () => {
      const functionExpectedToThrow = () => {
        getLoginConfigurationFromEnv();
      };

      vi.stubEnv(LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME, '');
      expect(functionExpectedToThrow).toThrow();

      vi.stubEnv(LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME, '{bogus json}');
      expect(functionExpectedToThrow).toThrow();

      const expectedConfiguration = { url: 'http://localhost/' };
      vi.stubEnv(LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME, JSON.stringify(expectedConfiguration));
      expect(getLoginConfigurationFromEnv()).toEqual(expectedConfiguration);
    });
  });
});
