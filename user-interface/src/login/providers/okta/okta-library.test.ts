import OktaAuth, { UserClaims } from '@okta/okta-auth-js';
import { describe, test, beforeEach, afterEach, vi, expect } from 'vitest';
import { getCamsUser, refreshOktaToken, registerRefreshOktaToken } from './okta-library';
import LocalStorage from '@/lib/utils/local-storage';
import { MockData } from '@common/cams/test-utilities/mock-data';
import * as apiModule from '@/lib/models/api';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsSession } from '@common/cams/session';
import { urlRegex } from '@common/cams/test-utilities/regex';
import Api2 from '@/lib/models/api2';
import * as sessionEndLogout from '@/login/session-end-logout';

const MOCK_OAUTH_CONFIG = { issuer: 'https://mock.okta.com/oauth2/default' };

const ONE_HOUR = 3600000;
const TEN_SECONDS = 10000;

const EXPIRATION_SECONDS = 7200000;
const EXPIRATION = EXPIRATION_SECONDS * 1000;
const WAY_BEFORE_EXPIRATION = EXPIRATION - ONE_HOUR;
const JUST_BEFORE_EXPIRATION = EXPIRATION - TEN_SECONDS;
const AFTER_EXPIRATION = EXPIRATION + TEN_SECONDS;
const NEW_EXPIRATION = EXPIRATION + TEN_SECONDS * 2;

const ACCESS_TOKEN = MockData.getJwt();
const REFRESHED_ACCESS_TOKEN = MockData.getJwt();

describe('Okta library', () => {
  describe('registerRefreshOktaToken', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should register refreshOktaToken with the api', () => {
      const addApiBeforeHook = vi.spyOn(apiModule, 'addApiBeforeHook');

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      registerRefreshOktaToken(oktaAuth);

      expect(addApiBeforeHook).toHaveBeenCalled();
    });
  });

  describe('getCamsUser tests', () => {
    test('should return user name', () => {
      const name = 'Bobby Flay';
      const email = 'bobbyFlay@fake.com';
      const userClaims: UserClaims = { sub: email, name, email };
      expect(getCamsUser(userClaims)).toEqual({ id: userClaims.sub, name });
    });

    test('should return user email', () => {
      const email = 'bobbyFlay@fake.com';
      const userClaims: UserClaims = { sub: email, email };
      expect(getCamsUser(userClaims)).toEqual({ id: userClaims.sub, name: email });
    });

    test('should return UNKNOWN', () => {
      const userClaims: UserClaims = { sub: 'nobody@nodomain.xyz' };
      expect(getCamsUser(userClaims)).toEqual({ id: userClaims.sub, name: 'UNKNOWN' });
    });
  });

  describe('refreshOktaToken', () => {
    const { waitFor } = TestingUtilities;
    let oktaAuth: OktaAuth;

    const userClaims: UserClaims = {
      iss: 'http://issuer/',
      sub: 'nobody@nodomain.xyz',
      name: 'mock user',
      exp: EXPIRATION_SECONDS,
    };

    const camsSession: CamsSession = {
      provider: 'okta',
      accessToken: ACCESS_TOKEN,
      user: { id: userClaims.sub, name: 'mock user' },
      expires: EXPIRATION_SECONDS,
      issuer: userClaims.iss ?? '',
    };

    beforeEach(() => {
      vi.useFakeTimers();

      // Mock localStorage like we do with Highlight API
      const localStorageMock = (() => {
        let store: Record<string, string> = {};

        return {
          getItem: (key: string) => {
            return store[key] || null;
          },
          setItem: (key: string, value: string) => {
            store[key] = value.toString();
          },
          removeItem: (key: string) => {
            delete store[key];
          },
          clear: () => {
            store = {};
          },
        };
      })();

      vi.stubGlobal('localStorage', localStorageMock);
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
        configurable: true,
      });

      oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    });

    test('should do nothing if a session does not exist', async () => {
      const getSession = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const setSession = vi.spyOn(LocalStorage, 'setSession');

      await refreshOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should do nothing if verified claims does not include an expiration', async () => {
      const getSession = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const setSession = vi.spyOn(LocalStorage, 'setSession');

      await refreshOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should do nothing if the expiration is not set to expire soon', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(WAY_BEFORE_EXPIRATION);
      const getSession = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const setSession = vi.spyOn(LocalStorage, 'setSession');

      await refreshOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should refresh the access token', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);
      const getSession = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const setSession = vi.spyOn(LocalStorage, 'setSession');
      const isTokenBeingRefreshedSpy = vi
        .spyOn(LocalStorage, 'isTokenBeingRefreshed')
        .mockReturnValue(false);
      const setRefreshingTokenSpy = vi
        .spyOn(LocalStorage, 'setRefreshingToken')
        .mockReturnValue(true);
      const removeRefreshingTokenSpy = vi.spyOn(LocalStorage, 'removeRefreshingToken');

      const getUser = vi
        .spyOn(OktaAuth.prototype, 'getUser')
        .mockResolvedValue({ ...userClaims, exp: NEW_EXPIRATION });
      const getOrRenewAccessToken = vi
        .spyOn(OktaAuth.prototype, 'getOrRenewAccessToken')
        .mockResolvedValue(REFRESHED_ACCESS_TOKEN);

      const mockApi2GetMe = vi.spyOn(Api2, 'getMe').mockResolvedValue({
        data: {
          ...camsSession,
          accessToken: REFRESHED_ACCESS_TOKEN,
          expires: NEW_EXPIRATION / 1000,
        },
      });
      const mockInitializeSessionEndLogout = vi
        .spyOn(sessionEndLogout, 'initializeSessionEndLogout')
        .mockImplementation(() => {});

      oktaAuth.token.decode = vi.fn().mockImplementation(() => {
        return {
          payload: {
            exp: NEW_EXPIRATION / 1000,
            iss: userClaims.iss,
          },
        };
      });

      await refreshOktaToken(oktaAuth);

      // Fast-forward the timers to trigger the setTimeout callback
      await vi.runAllTimersAsync();

      // Wait for all async operations to complete
      await waitFor(() => {
        return removeRefreshingTokenSpy.mock.calls.length > 0;
      });

      expect(getOrRenewAccessToken).toHaveBeenCalled();
      expect(getUser).toHaveBeenCalled();
      expect(mockApi2GetMe).toHaveBeenCalled();
      expect(mockInitializeSessionEndLogout).toHaveBeenCalled();

      expect(isTokenBeingRefreshedSpy).toHaveBeenCalled();
      expect(setRefreshingTokenSpy).toHaveBeenCalled();
      expect(removeRefreshingTokenSpy).toHaveBeenCalled();

      expect(getSession).toHaveBeenCalled();
      expect(setSession).toHaveBeenCalledWith({
        provider: 'okta',
        accessToken: REFRESHED_ACCESS_TOKEN,
        user: expect.any(Object),
        expires: expect.any(Number),
        issuer: expect.stringMatching(urlRegex),
      });
    });

    test('should refresh the access token after it has expired', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(AFTER_EXPIRATION);
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const setSession = vi.spyOn(LocalStorage, 'setSession');
      vi.spyOn(LocalStorage, 'isTokenBeingRefreshed').mockReturnValue(false);
      const setRefreshingTokenSpy = vi
        .spyOn(LocalStorage, 'setRefreshingToken')
        .mockReturnValue(true);
      const removeRefreshingTokenSpy = vi.spyOn(LocalStorage, 'removeRefreshingToken');

      vi.spyOn(OktaAuth.prototype, 'getUser').mockResolvedValue(userClaims);
      vi.spyOn(OktaAuth.prototype, 'getOrRenewAccessToken').mockResolvedValue(
        REFRESHED_ACCESS_TOKEN,
      );

      const mockApi2GetMe = vi.spyOn(Api2, 'getMe').mockResolvedValue({
        data: {
          ...camsSession,
          accessToken: REFRESHED_ACCESS_TOKEN,
          expires: NEW_EXPIRATION / 1000,
        },
      });
      vi.spyOn(sessionEndLogout, 'initializeSessionEndLogout').mockImplementation(() => {});

      oktaAuth.token.decode = vi.fn().mockImplementation(() => {
        return {
          payload: {
            exp: NEW_EXPIRATION / 1000,
            iss: userClaims.iss,
          },
        };
      });

      await refreshOktaToken(oktaAuth);

      // Fast-forward the timers to trigger the setTimeout callback
      await vi.runAllTimersAsync();

      await waitFor(() => {
        return removeRefreshingTokenSpy.mock.calls.length > 0;
      });

      expect(setSession).toHaveBeenCalled();
      expect(setRefreshingTokenSpy).toHaveBeenCalled();
      expect(removeRefreshingTokenSpy).toHaveBeenCalled();
      expect(mockApi2GetMe).toHaveBeenCalled();
    });

    test('should do nothing if an error is encountered', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const setSession = vi.spyOn(LocalStorage, 'setSession');
      vi.spyOn(LocalStorage, 'isTokenBeingRefreshed').mockReturnValue(false);
      const setRefreshingTokenSpy = vi
        .spyOn(LocalStorage, 'setRefreshingToken')
        .mockReturnValue(true);
      const removeRefreshingTokenSpy = vi.spyOn(LocalStorage, 'removeRefreshingToken');
      vi.spyOn(OktaAuth.prototype, 'getOrRenewAccessToken').mockRejectedValue(
        new Error('some error calling Okta'),
      );
      const mockApi2GetMe = vi.spyOn(Api2, 'getMe');

      await refreshOktaToken(oktaAuth);

      // Fast-forward the timers to trigger the setTimeout callback
      await vi.runAllTimersAsync();

      await waitFor(() => {
        return removeRefreshingTokenSpy.mock.calls.length > 0;
      });

      expect(setSession).not.toHaveBeenCalled();
      expect(setRefreshingTokenSpy).toHaveBeenCalled();
      expect(removeRefreshingTokenSpy).toHaveBeenCalled();
      // API should not be called if there's an error getting the token
      expect(mockApi2GetMe).not.toHaveBeenCalled();
    });

    test('should do nothing if the token is already being refreshed', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const setSession = vi.spyOn(LocalStorage, 'setSession');
      vi.spyOn(OktaAuth.prototype, 'getUser').mockResolvedValue(userClaims);

      // Mock the function to return true (already refreshing)
      vi.spyOn(LocalStorage, 'isTokenBeingRefreshed').mockReturnValue(true);
      const setRefreshingTokenSpy = vi.spyOn(LocalStorage, 'setRefreshingToken');
      const removeRefreshingTokenSpy = vi.spyOn(LocalStorage, 'removeRefreshingToken');

      await refreshOktaToken(oktaAuth);

      expect(setSession).not.toHaveBeenCalled();
      expect(setRefreshingTokenSpy).not.toHaveBeenCalled();
      expect(removeRefreshingTokenSpy).not.toHaveBeenCalled();
    });
  });
});
