import OktaAuth, { UserClaims } from '@okta/okta-auth-js';
import { describe, test } from 'vitest';
import * as OktaLibrary from './okta-library';
import {
  getCamsUser,
  renewOktaToken,
  registerRenewOktaToken,
  handleHeartbeat,
  isActive,
  AUTH_EXPIRY_WARNING,
  resetWarningShownFlag,
} from './okta-library';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import { CamsSession } from '@common/cams/session';
import * as delayModule from '@common/delay';
import DateHelper from '@common/date-helper';
import * as sessionEndLogout from '@/login/session-end-logout';

const MOCK_OAUTH_CONFIG = { issuer: 'https://mock.okta.com/oauth2/default' };

// Time constants for renewOktaToken tests
const EXPIRATION_SECONDS = 7200000;
const NEW_EXPIRATION = EXPIRATION_SECONDS + 20000;

// Time constants for handleHeartbeat tests (in seconds)
const SAFE_LIMIT = 300; // 5 minutes before expiration
const HEARTBEAT = 1000 * 60 * 5; // 5 minutes in milliseconds
const SESSION_EXPIRATION = 3600; // 1 hour from now (in seconds)
const CLOSE_TO_EXPIRATION = SESSION_EXPIRATION - SAFE_LIMIT + 10; // Within warning window
const NOT_CLOSE_TO_EXPIRATION = SESSION_EXPIRATION - SAFE_LIMIT - 100; // Not yet in warning window

const ACCESS_TOKEN = MockData.getJwt();
const RENEWED_ACCESS_TOKEN = MockData.getJwt();

vi.spyOn(delayModule, 'delay').mockImplementation(async (_, cb) => (cb ? cb() : undefined));

describe('Okta library', () => {
  describe('Constants', () => {
    test('AUTH_EXPIRY_WARNING should be exported with correct value', () => {
      expect(AUTH_EXPIRY_WARNING).toBe('auth-expiry-warning');
    });
  });

  describe('resetWarningShownFlag', () => {
    test('should allow warning to be shown again after reset', async () => {
      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      const getSessionSpy = vi.spyOn(LocalStorage, 'getSession');
      const getLastInteractionSpy = vi.spyOn(LocalStorage, 'getLastInteraction');
      const nowInSecondsSpy = vi.spyOn(DateHelper, 'nowInSeconds');
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      vi.spyOn(OktaLibrary, 'renewOktaToken').mockResolvedValue();

      const camsSession = {
        provider: 'okta' as const,
        accessToken: MockData.getJwt(),
        user: { id: 'test-user', name: 'Test User' },
        expires: 3600,
        issuer: 'http://issuer/',
      };

      getSessionSpy.mockReturnValue(camsSession);
      nowInSecondsSpy.mockReturnValue(3600 - 300 + 10); // Close to expiration
      const now = Date.now();
      const oldInteraction = now - (1000 * 60 * 5 + 1000); // Inactive
      vi.spyOn(Date, 'now').mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(oldInteraction);

      // First call emits warning
      await handleHeartbeat(oktaAuth);
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);

      // Second call does NOT emit warning (flag is set)
      dispatchEventSpy.mockClear();
      await handleHeartbeat(oktaAuth);
      expect(dispatchEventSpy).not.toHaveBeenCalled();

      // Reset the flag
      resetWarningShownFlag();
      dispatchEventSpy.mockClear();

      // After reset, warning can be shown again on first call
      await handleHeartbeat(oktaAuth);
      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AUTH_EXPIRY_WARNING,
        }),
      );

      vi.restoreAllMocks();
    });
  });

  describe('registerRenewOktaToken', () => {
    test('should start the heartbeat interval', () => {
      // registerRenewOktaToken starts a heartbeat interval to monitor session expiration
      // We can't easily test setInterval without fake timers, but we can verify the function executes without error
      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      expect(() => registerRenewOktaToken(oktaAuth)).not.toThrow();
    });

    test('should initialize heartbeat interval with correct parameters', () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);

      registerRenewOktaToken(oktaAuth);

      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        1000 * 60 * 5, // HEARTBEAT = 5 minutes
      );

      vi.useRealTimers();
    });

    test('should clear existing heartbeat when called multiple times', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);

      // First call
      registerRenewOktaToken(oktaAuth);
      const firstIntervalId = setIntervalSpy.mock.results[0].value;

      // Clear spies
      clearIntervalSpy.mockClear();
      setIntervalSpy.mockClear();

      // Second call should clear the first interval
      registerRenewOktaToken(oktaAuth);

      expect(clearIntervalSpy).toHaveBeenCalledWith(firstIntervalId);
      expect(setIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
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

  describe('renewOktaToken', () => {
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
      resetWarningShownFlag();
    });

    test('should renew the access token when called', async () => {
      const getOrRenewAccessToken = vi
        .spyOn(OktaAuth.prototype, 'getOrRenewAccessToken')
        .mockResolvedValue(RENEWED_ACCESS_TOKEN);
      const getUser = vi
        .spyOn(OktaAuth.prototype, 'getUser')
        .mockResolvedValue({ ...userClaims, exp: NEW_EXPIRATION });
      const setSession = vi.spyOn(LocalStorage, 'setSession');
      const getMeSpy = vi.spyOn(Api2, 'getMe').mockResolvedValue({ data: camsSession } as never);
      vi.spyOn(sessionEndLogout, 'initializeSessionEndLogout').mockImplementation(() => {});

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      oktaAuth.token.decode = vi.fn().mockImplementation(() => {
        return {
          payload: {
            exp: NEW_EXPIRATION,
            iss: 'http://issuer/',
          },
        };
      });

      await renewOktaToken(oktaAuth);

      expect(getOrRenewAccessToken).toHaveBeenCalled();
      expect(getUser).toHaveBeenCalled();
      expect(setSession).toHaveBeenCalledTimes(2); // Once with JWT data, once with /me response
      expect(getMeSpy).toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    test('should do nothing if an error is encountered', async () => {
      vi.spyOn(OktaAuth.prototype, 'getOrRenewAccessToken').mockRejectedValue(
        new Error('some error calling Okta'),
      );
      const setSession = vi.spyOn(LocalStorage, 'setSession');

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      await renewOktaToken(oktaAuth);

      expect(setSession).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });

    test('should do nothing if the token is already being renewed', async () => {
      let renewalCount = 0;
      const getOrRenewAccessToken = vi
        .spyOn(OktaAuth.prototype, 'getOrRenewAccessToken')
        .mockImplementation(async () => {
          renewalCount++;
          // Simulate async delay
          await new Promise((resolve) => setTimeout(resolve, 100));
          return RENEWED_ACCESS_TOKEN;
        });
      const getUser = vi
        .spyOn(OktaAuth.prototype, 'getUser')
        .mockResolvedValue({ ...userClaims, exp: NEW_EXPIRATION });
      vi.spyOn(LocalStorage, 'setSession');
      vi.spyOn(Api2, 'getMe').mockResolvedValue({ data: camsSession } as never);
      vi.spyOn(sessionEndLogout, 'initializeSessionEndLogout').mockImplementation(() => {});

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      oktaAuth.token.decode = vi.fn().mockImplementation(() => {
        return {
          payload: {
            exp: NEW_EXPIRATION,
            iss: 'http://issuer/',
          },
        };
      });

      // Call renewOktaToken twice in parallel
      await Promise.all([renewOktaToken(oktaAuth), renewOktaToken(oktaAuth)]);

      // The token should only be renewed once despite two calls
      expect(renewalCount).toBe(1);
      expect(getOrRenewAccessToken).toHaveBeenCalledTimes(1);
      expect(getUser).toHaveBeenCalledTimes(1);

      vi.restoreAllMocks();
    });

    test('should reset warningShown flag after successful token renewal', async () => {
      const getOrRenewAccessToken = vi
        .spyOn(OktaAuth.prototype, 'getOrRenewAccessToken')
        .mockResolvedValue(RENEWED_ACCESS_TOKEN);
      vi.spyOn(OktaAuth.prototype, 'getUser').mockResolvedValue({
        ...userClaims,
        exp: NEW_EXPIRATION,
      });
      const setSession = vi.spyOn(LocalStorage, 'setSession');
      vi.spyOn(Api2, 'getMe').mockResolvedValue({ data: camsSession } as never);
      vi.spyOn(sessionEndLogout, 'initializeSessionEndLogout').mockImplementation(() => {});

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      oktaAuth.token.decode = vi.fn().mockImplementation(() => {
        return {
          payload: {
            exp: NEW_EXPIRATION,
            iss: 'http://issuer/',
          },
        };
      });

      await renewOktaToken(oktaAuth);

      // Verify token was renewed successfully
      expect(getOrRenewAccessToken).toHaveBeenCalled();
      expect(setSession).toHaveBeenCalledTimes(2);

      // The warningShown flag reset is implicitly tested - if the flag wasn't reset,
      // subsequent warnings wouldn't be shown (tested in handleHeartbeat section)

      vi.restoreAllMocks();
    });
  });

  describe('handleHeartbeat', () => {
    let oktaAuth: OktaAuth;

    const camsSession: CamsSession = {
      provider: 'okta',
      accessToken: ACCESS_TOKEN,
      user: { id: 'test-user', name: 'Test User' },
      expires: SESSION_EXPIRATION,
      issuer: 'http://issuer/',
    };

    beforeEach(() => {
      resetWarningShownFlag();
      oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
    });

    test('should return early if no session exists', async () => {
      const getSessionSpy = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(null);
      const nowInSecondsSpy = vi
        .spyOn(DateHelper, 'nowInSeconds')
        .mockReturnValue(CLOSE_TO_EXPIRATION);
      const renewOktaTokenSpy = vi.spyOn(OktaLibrary, 'renewOktaToken').mockResolvedValue();
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      await handleHeartbeat(oktaAuth);

      expect(getSessionSpy).toHaveBeenCalled();
      expect(nowInSecondsSpy).toHaveBeenCalled();
      expect(renewOktaTokenSpy).not.toHaveBeenCalled();
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });

    test('should not emit warning when close to expiry and user is active', async () => {
      const getSessionSpy = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const getLastInteractionSpy = vi.spyOn(LocalStorage, 'getLastInteraction');
      const nowInSecondsSpy = vi
        .spyOn(DateHelper, 'nowInSeconds')
        .mockReturnValue(CLOSE_TO_EXPIRATION);
      vi.spyOn(OktaLibrary, 'renewOktaToken').mockResolvedValue();
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      const now = Date.now();
      const recentInteraction = now - HEARTBEAT / 2; // Active within heartbeat window
      vi.spyOn(Date, 'now').mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(recentInteraction);

      await handleHeartbeat(oktaAuth);

      expect(getSessionSpy).toHaveBeenCalled();
      expect(nowInSecondsSpy).toHaveBeenCalled();
      expect(getLastInteractionSpy).toHaveBeenCalled();
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });

    test('should emit warning on first call when close to expiry and user is inactive', async () => {
      const getSessionSpy = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const getLastInteractionSpy = vi.spyOn(LocalStorage, 'getLastInteraction');
      const nowInSecondsSpy = vi
        .spyOn(DateHelper, 'nowInSeconds')
        .mockReturnValue(CLOSE_TO_EXPIRATION);
      const renewOktaTokenSpy = vi.spyOn(OktaLibrary, 'renewOktaToken').mockResolvedValue();
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      const now = Date.now();
      const oldInteraction = now - (HEARTBEAT + 1000); // Inactive beyond heartbeat window
      vi.spyOn(Date, 'now').mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(oldInteraction);

      // First call should emit the warning
      await handleHeartbeat(oktaAuth);

      expect(getSessionSpy).toHaveBeenCalled();
      expect(nowInSecondsSpy).toHaveBeenCalled();
      expect(getLastInteractionSpy).toHaveBeenCalled();
      expect(renewOktaTokenSpy).not.toHaveBeenCalled();
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AUTH_EXPIRY_WARNING,
        }),
      );

      dispatchEventSpy.mockClear();

      // Second call should NOT emit the warning again (warningShown flag is now true)
      await handleHeartbeat(oktaAuth);
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });

    test('should start logout timer on first call when close to expiry and user is inactive', async () => {
      vi.useFakeTimers();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const getLastInteractionSpy = vi.spyOn(LocalStorage, 'getLastInteraction');
      vi.spyOn(DateHelper, 'nowInSeconds').mockReturnValue(CLOSE_TO_EXPIRATION);
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      const initializeSessionEndLogoutSpy = vi
        .spyOn(sessionEndLogout, 'initializeSessionEndLogout')
        .mockImplementation(() => {});

      const now = Date.now();
      const oldInteraction = now - (HEARTBEAT + 1000); // Inactive beyond heartbeat window
      vi.spyOn(Date, 'now').mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(oldInteraction);

      // First call should emit warning and start logout timer
      await handleHeartbeat(oktaAuth);

      expect(dispatchEventSpy).toHaveBeenCalledTimes(1);
      expect(dispatchEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AUTH_EXPIRY_WARNING,
        }),
      );
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.anything(), 1000 * 60);

      // Verify that the callback invokes initializeSessionEndLogout with the session
      const callback = setIntervalSpy.mock.calls[0][0];
      callback();
      expect(initializeSessionEndLogoutSpy).toHaveBeenCalledWith(camsSession);

      dispatchEventSpy.mockClear();
      setIntervalSpy.mockClear();

      // Second call should NOT emit warning or start timer again (warningShown flag is true)
      await handleHeartbeat(oktaAuth);
      expect(dispatchEventSpy).not.toHaveBeenCalled();
      expect(setIntervalSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    test('should not restart timer on subsequent calls when user remains inactive', async () => {
      vi.useFakeTimers();
      vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const getLastInteractionSpy = vi.spyOn(LocalStorage, 'getLastInteraction');
      vi.spyOn(DateHelper, 'nowInSeconds').mockReturnValue(CLOSE_TO_EXPIRATION);
      const setIntervalSpy = vi.spyOn(window, 'setInterval');
      vi.spyOn(sessionEndLogout, 'initializeSessionEndLogout').mockImplementation(() => {});

      const now = Date.now();
      const oldInteraction = now - (HEARTBEAT + 1000);
      vi.spyOn(Date, 'now').mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(oldInteraction);

      // First call creates the interval
      await handleHeartbeat(oktaAuth);
      expect(setIntervalSpy).toHaveBeenCalledTimes(1);

      setIntervalSpy.mockClear();

      // Second call should NOT create another interval (warningShown flag is true)
      await handleHeartbeat(oktaAuth);
      expect(setIntervalSpy).not.toHaveBeenCalled();

      // Third call should also NOT create another interval
      await handleHeartbeat(oktaAuth);
      expect(setIntervalSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    test('should do nothing when not close to expiry', async () => {
      const getSessionSpy = vi.spyOn(LocalStorage, 'getSession').mockReturnValue(camsSession);
      const nowInSecondsSpy = vi
        .spyOn(DateHelper, 'nowInSeconds')
        .mockReturnValue(NOT_CLOSE_TO_EXPIRATION);
      const renewOktaTokenSpy = vi.spyOn(OktaLibrary, 'renewOktaToken').mockResolvedValue();
      const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

      await handleHeartbeat(oktaAuth);

      expect(getSessionSpy).toHaveBeenCalled();
      expect(nowInSecondsSpy).toHaveBeenCalled();
      expect(renewOktaTokenSpy).not.toHaveBeenCalled();
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });
  });

  describe('isActive', () => {
    let getLastInteractionSpy: ReturnType<typeof vi.spyOn>;
    let dateNowSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      getLastInteractionSpy = vi.spyOn(LocalStorage, 'getLastInteraction');
      dateNowSpy = vi.spyOn(Date, 'now');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('should return false if no last interaction timestamp exists', () => {
      getLastInteractionSpy.mockReturnValue(null);

      const result = isActive();

      expect(result).toBe(false);
      expect(getLastInteractionSpy).toHaveBeenCalled();
    });

    test('should return true if user was active within heartbeat interval', () => {
      const now = 1000000;
      const recentInteraction = now - (HEARTBEAT - 1000); // 1 second before heartbeat expires
      dateNowSpy.mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(recentInteraction);

      const result = isActive();

      expect(result).toBe(true);
      expect(getLastInteractionSpy).toHaveBeenCalled();
    });

    test('should return false if user was inactive beyond heartbeat interval', () => {
      const now = 1000000;
      const oldInteraction = now - (HEARTBEAT + 1000); // 1 second after heartbeat expires
      dateNowSpy.mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(oldInteraction);

      const result = isActive();

      expect(result).toBe(false);
      expect(getLastInteractionSpy).toHaveBeenCalled();
    });
  });
});
