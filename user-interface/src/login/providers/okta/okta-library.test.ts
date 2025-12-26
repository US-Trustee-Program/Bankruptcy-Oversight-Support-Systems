import OktaAuth, { UserClaims } from '@okta/okta-auth-js';
import { describe, test } from 'vitest';
import { getCamsUser, renewOktaToken, registerRenewOktaToken } from './okta-library';
import LocalStorage from '@/lib/utils/local-storage';
import MockData from '@common/cams/test-utilities/mock-data';
import * as apiModule from '@/lib/models/api';
import TestingUtilities from '@/lib/testing/testing-utilities';
import { CamsSession } from '@common/cams/session';
import * as delayModule from '@common/delay';

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
const RENEWED_ACCESS_TOKEN = MockData.getJwt();

vi.spyOn(delayModule, 'delay').mockImplementation(async (_, cb) => (cb ? cb() : undefined));

describe('Okta library', () => {
  const { nonReactWaitFor } = TestingUtilities;
  describe('registerRenewOktaToken', () => {
    test('should register renewOktaToken with the api', () => {
      const addApiBeforeHook = vi.spyOn(apiModule, 'addApiBeforeHook');

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      registerRenewOktaToken(oktaAuth);

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
    const getSession = vi.spyOn(LocalStorage, 'getSession');
    const setSession = vi.spyOn(LocalStorage, 'setSession');

    const isTokenBeingRenewedSpy = vi.spyOn(LocalStorage, 'isTokenBeingRenewed');
    const setRenewingTokenSpy = vi.spyOn(LocalStorage, 'setRenewingToken');
    const removeRenewingTokenSpy = vi.spyOn(LocalStorage, 'removeRenewingToken');

    beforeEach(() => {
      vi.clearAllMocks();
      oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
    });

    test('should do nothing if a session does not exist', async () => {
      getSession.mockReturnValue(null);
      await renewOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should do nothing if verified claims does not include an expiration', async () => {
      getSession.mockReturnValue(camsSession);
      await renewOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should do nothing if the expiration is not set to expire soon', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(WAY_BEFORE_EXPIRATION);
      await renewOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should renew the access token', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);

      getSession.mockReturnValue(camsSession);
      getOrRenewAccessToken.mockResolvedValue(RENEWED_ACCESS_TOKEN);
      getUser.mockResolvedValue({ ...userClaims, exp: NEW_EXPIRATION });

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      oktaAuth.token.decode = vi.fn().mockImplementation(() => {
        return {
          payload: {
            exp: NEW_EXPIRATION,
          },
        };
      });

      await renewOktaToken(oktaAuth);

      await nonReactWaitFor(() => {
        return removeRenewingTokenSpy.mock.calls.length > 0;
      });
      expect(getOrRenewAccessToken).toHaveBeenCalled();
      expect(getUser).toHaveBeenCalled();

      expect(isTokenBeingRenewedSpy).toHaveBeenCalled();
      expect(setRenewingTokenSpy).toHaveBeenCalled();
      expect(removeRenewingTokenSpy).toHaveBeenCalled();

      expect(getSession).toHaveBeenCalled();
      expect(setSession).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'okta',
          accessToken: RENEWED_ACCESS_TOKEN,
          user: { id: userClaims.sub, name: 'mock user' },
          expires: 7200020000,
          issuer: '',
        }),
      );
    });

    test('should renew the access token after it has expired', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(AFTER_EXPIRATION);
      getOrRenewAccessToken.mockResolvedValue(RENEWED_ACCESS_TOKEN);

      getSession.mockReturnValue(camsSession);
      getUser.mockResolvedValue(userClaims);

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      oktaAuth.token.decode = vi.fn().mockImplementation(() => {
        return {
          payload: {
            exp: NEW_EXPIRATION,
          },
        };
      });
      await renewOktaToken(oktaAuth);

      await nonReactWaitFor(() => {
        return removeRenewingTokenSpy.mock.calls.length > 0;
      });
      expect(setSession).toHaveBeenCalled();
      expect(setRenewingTokenSpy).toHaveBeenCalled();
      expect(removeRenewingTokenSpy).toHaveBeenCalled();
    });

    test('should do nothing if an error is encountered', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);
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
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);

      getSession.mockReturnValue(camsSession);
      getUser.mockResolvedValue(userClaims);

      vi.spyOn(LocalStorage, 'isTokenBeingRenewed')
        .mockReturnValueOnce(false)
        .mockReturnValue(true);
      await renewOktaToken(oktaAuth);
      expect(setSession).not.toHaveBeenCalled();
    });
  });
});
