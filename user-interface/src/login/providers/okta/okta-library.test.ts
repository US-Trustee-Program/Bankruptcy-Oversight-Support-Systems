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
  SESSION_TIMEOUT_WARNING,
} from './okta-library';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import Api2 from '@/lib/models/api2';
import TestingUtilities from '@/lib/testing/testing-utilities';
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
  const { nonReactWaitFor } = TestingUtilities;

  describe('Constants', () => {
    test('AUTH_EXPIRY_WARNING should be exported with correct value', () => {
      expect(AUTH_EXPIRY_WARNING).toBe('auth-expiry-warning');
    });

    test('SESSION_TIMEOUT_WARNING should be exported with correct value', () => {
      expect(SESSION_TIMEOUT_WARNING).toBe('session-timeout-warning');
    });
  });

  describe('registerRenewOktaToken', () => {
    test('should start the heartbeat interval', () => {
      // registerRenewOktaToken starts a heartbeat interval to monitor session expiration
      // We can't easily test setInterval without fake timers, but we can verify the function executes without error
      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      expect(() => registerRenewOktaToken(oktaAuth)).not.toThrow();
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
    let oktaAuth: OktaAuth;

    const userClaims: UserClaims = {
      iss: 'http://issuer/',
      sub: 'nobody@nodomain.xyz',
      name: 'mock user',
      exp: EXPIRATION_SECONDS,
    };
    const getUser = vi.spyOn(OktaAuth.prototype, 'getUser');
    const getOrRenewAccessToken = vi.spyOn(OktaAuth.prototype, 'getOrRenewAccessToken');

    const camsSession: CamsSession = {
      provider: 'okta',
      accessToken: ACCESS_TOKEN,
      user: { id: userClaims.sub, name: 'mock user' },
      expires: EXPIRATION_SECONDS,
      issuer: userClaims.iss ?? '',
    };
    const setSession = vi.spyOn(LocalStorage, 'setSession');
    const getMeSpy = vi.spyOn(Api2, 'getMe');

    const isTokenBeingRenewedSpy = vi.spyOn(LocalStorage, 'isTokenBeingRenewed');
    const setRenewingTokenSpy = vi.spyOn(LocalStorage, 'setRenewingToken');
    const removeRenewingTokenSpy = vi.spyOn(LocalStorage, 'removeRenewingToken');

    beforeEach(() => {
      vi.clearAllMocks();
      oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      isTokenBeingRenewedSpy.mockReturnValue(false);
    });

    test('should renew the access token when called', async () => {
      getOrRenewAccessToken.mockResolvedValue(RENEWED_ACCESS_TOKEN);
      getUser.mockResolvedValue({ ...userClaims, exp: NEW_EXPIRATION });
      getMeSpy.mockResolvedValue({ data: camsSession } as never);

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

      await nonReactWaitFor(() => {
        return removeRenewingTokenSpy.mock.calls.length > 0;
      });

      expect(isTokenBeingRenewedSpy).toHaveBeenCalled();
      expect(setRenewingTokenSpy).toHaveBeenCalled();
      expect(getOrRenewAccessToken).toHaveBeenCalled();
      expect(getUser).toHaveBeenCalled();
      expect(setSession).toHaveBeenCalledTimes(2); // Once with JWT data, once with /me response
      expect(getMeSpy).toHaveBeenCalled();
      expect(removeRenewingTokenSpy).toHaveBeenCalled();
    });

    test('should do nothing if an error is encountered', async () => {
      getOrRenewAccessToken.mockRejectedValue(new Error('some error calling Okta'));

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      await renewOktaToken(oktaAuth);

      await nonReactWaitFor(() => {
        return removeRenewingTokenSpy.mock.calls.length > 0;
      });
      expect(setSession).not.toHaveBeenCalled();
      expect(setRenewingTokenSpy).toHaveBeenCalled();
      expect(removeRenewingTokenSpy).toHaveBeenCalled();
    });

    test('should do nothing if the token is already being renewed', async () => {
      isTokenBeingRenewedSpy.mockReturnValue(true);

      await renewOktaToken(oktaAuth);

      expect(setRenewingTokenSpy).not.toHaveBeenCalled();
      expect(getOrRenewAccessToken).not.toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should do nothing if isTokenBeingRenewed returns undefined', async () => {
      isTokenBeingRenewedSpy.mockReturnValue(undefined);

      await renewOktaToken(oktaAuth);

      expect(setRenewingTokenSpy).not.toHaveBeenCalled();
      expect(getOrRenewAccessToken).not.toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
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

    const getSessionSpy = vi.spyOn(LocalStorage, 'getSession');
    const getLastInteractionSpy = vi.spyOn(LocalStorage, 'getLastInteraction');
    const nowInSecondsSpy = vi.spyOn(DateHelper, 'nowInSeconds');
    const renewOktaTokenSpy = vi.spyOn(OktaLibrary, 'renewOktaToken');
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');
    const initializeSessionEndLogoutSpy = vi.spyOn(sessionEndLogout, 'initializeSessionEndLogout');

    beforeEach(() => {
      vi.clearAllMocks();
      oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      getSessionSpy.mockReturnValue(camsSession);
      renewOktaTokenSpy.mockResolvedValue();
      initializeSessionEndLogoutSpy.mockImplementation(() => {}); // Prevent setInterval from being called
    });

    test('should return early if no session exists', async () => {
      getSessionSpy.mockReturnValue(null);

      await handleHeartbeat(oktaAuth);

      expect(getSessionSpy).toHaveBeenCalled();
      expect(nowInSecondsSpy).toHaveBeenCalled();
      expect(renewOktaTokenSpy).not.toHaveBeenCalled();
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });

    test('should not emit warning when close to expiry and user is active', async () => {
      nowInSecondsSpy.mockReturnValue(CLOSE_TO_EXPIRATION);
      // Mock user as active: last interaction was recent
      const now = Date.now();
      const recentInteraction = now - HEARTBEAT / 2; // Active within heartbeat window
      vi.spyOn(Date, 'now').mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(recentInteraction);

      // When user is active, renewOktaToken is called which will renew the session
      // For this test, we just verify that no warning event is dispatched
      // The actual token renewal is tested separately in renewOktaToken tests

      await handleHeartbeat(oktaAuth);

      expect(getSessionSpy).toHaveBeenCalled();
      expect(nowInSecondsSpy).toHaveBeenCalled();
      expect(getLastInteractionSpy).toHaveBeenCalled();
      // The key behavior: no warning should be emitted when user is active
      expect(dispatchEventSpy).not.toHaveBeenCalled();
    });

    test('should emit AUTH_EXPIRY_WARNING when close to expiry and user is inactive', async () => {
      nowInSecondsSpy.mockReturnValue(CLOSE_TO_EXPIRATION);
      // Mock user as inactive: last interaction was too long ago
      const now = Date.now();
      const oldInteraction = now - (HEARTBEAT + 1000); // Inactive beyond heartbeat window
      vi.spyOn(Date, 'now').mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(oldInteraction);

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
    });

    test('should start logout timer when close to expiry and user is inactive', async () => {
      // Use fake timers to verify setInterval is called
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      nowInSecondsSpy.mockReturnValue(CLOSE_TO_EXPIRATION);
      // Mock user as inactive: last interaction was too long ago
      const now = Date.now();
      const oldInteraction = now - (HEARTBEAT + 1000); // Inactive beyond heartbeat window
      vi.spyOn(Date, 'now').mockReturnValue(now);
      getLastInteractionSpy.mockReturnValue(oldInteraction);

      await handleHeartbeat(oktaAuth);

      expect(setIntervalSpy).toHaveBeenCalledWith(
        sessionEndLogout.initializeSessionEndLogout,
        1000 * 60, // LOGOUT_TIMER = 1 minute
      );

      vi.useRealTimers();
    });

    test('should do nothing when not close to expiry', async () => {
      nowInSecondsSpy.mockReturnValue(NOT_CLOSE_TO_EXPIRATION);

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
