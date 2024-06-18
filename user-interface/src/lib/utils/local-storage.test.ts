import { LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME } from '@/login/login-library';
import { LocalStorage, LOGIN_LOCAL_STORAGE_SESSION_KEY } from './local-storage';

describe('Local storage', () => {
  describe('getSession', () => {
    test('should return session from local storage', () => {
      const mockSessionString = '{"provider":"none","user":{"name":"Bert"}}';
      const expectedMockSession = {
        provider: 'none',
        user: {
          name: 'Bert',
        },
      };
      window.localStorage.setItem(LOGIN_LOCAL_STORAGE_SESSION_KEY, mockSessionString);
      vi.stubEnv(LOGIN_PROVIDER_CONFIG_ENV_VAR_NAME, 'none');
      const session = LocalStorage.getSession();
      expect(session).toEqual(expectedMockSession);
    });

    test('should return null from local storage', () => {
      window.localStorage.removeItem(LOGIN_LOCAL_STORAGE_SESSION_KEY);
      const session = LocalStorage.getSession();
      expect(session).toBeNull();
    });
  });

  describe('setSession', () => {
    test('', () => {});
  });

  describe('removeSession', () => {
    test('', () => {});
  });
});
