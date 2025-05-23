import { describe } from 'vitest';
import {
  getAuthIssuer,
  getLoginConfiguration,
  getLoginProvider,
  isLoginProviderType,
} from './login-library';
import { mockConfiguration } from '@/lib/testing/mock-configuration';

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

  describe('getLoginProvider', () => {
    test.each([...providerTypes, bogusType])('should get the provider type: %s', (key: string) => {
      mockConfiguration({
        loginProvider: key,
      });
      expect(getLoginProvider()).toEqual(key);
    });
    test.each(['', undefined])(
      'should throw an exception when provider type is not provided: %s',
      (key: string | undefined) => {
        mockConfiguration({
          loginProvider: key,
        });
        expect(() => getLoginProvider()).toThrow('Missing login provider');
      },
    );
  });

  describe('getLoginConfiguration', () => {
    test('should get the provider configuration', () => {
      const functionExpectedToThrow = () => {
        getLoginConfiguration();
      };

      mockConfiguration({
        loginProvider: 'okta',
        loginProviderConfig: '',
      });
      expect(functionExpectedToThrow).toThrow();

      mockConfiguration({
        loginProvider: 'okta',
        loginProviderConfig: 'url=http://localhost/',
      });
      const expectedConfiguration = { url: 'http://localhost/' };
      expect(getLoginConfiguration()).toEqual(expectedConfiguration);
    });
  });

  describe('getAuthIssuer', () => {
    test('should get the auth issuer', () => {
      const expectedIssuer = 'http://localhost/';
      mockConfiguration({
        loginProvider: 'okta',
        loginProviderConfig: `url=http://localhost/|issuer=${expectedIssuer}`,
      });
      const issuer = getAuthIssuer();
      expect(issuer).toEqual(expectedIssuer);
    });

    test('should return undefined for the issuer if not set', () => {
      mockConfiguration({
        loginProvider: 'okta',
        loginProviderConfig: 'foo=bar',
      });
      const issuer = getAuthIssuer();
      expect(issuer).toBeUndefined();
    });
  });
});
