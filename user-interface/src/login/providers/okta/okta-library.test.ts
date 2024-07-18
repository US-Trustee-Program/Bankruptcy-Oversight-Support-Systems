import OktaAuth, { AccessToken, AuthState, AuthStateManager, UserClaims } from '@okta/okta-auth-js';
import { describe, test } from 'vitest';
import {
  getCamsUser,
  getValidatedClaims,
  refreshOktaToken,
  registerRefreshOktaToken,
} from './okta-library';
import LocalStorage from '@/lib/utils/local-storage';
import { MockData } from '@common/cams/test-utilities/mock-data';
import * as apiModule from '@/lib/models/api';
import TestingUtilities from '@/lib/testing/testing-utilities';

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
  const { waitFor } = TestingUtilities;
  describe('registerRefreshOktaToken', () => {
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
      expect(getCamsUser(userClaims)).toEqual({ name });
    });

    test('should return user email', () => {
      const email = 'bobbyFlay@fake.com';
      const userClaims: UserClaims = { sub: email, email };
      expect(getCamsUser(userClaims)).toEqual({ name: email });
    });

    test('should return UNKNOWN', () => {
      const userClaims: UserClaims = { sub: 'nobody@nodomain.xyz' };
      expect(getCamsUser(userClaims)).toEqual({ name: 'UNKNOWN' });
    });
  });

  describe('getValidatedClaims tests', () => {
    test('should return claims from token', () => {
      const userClaims: UserClaims = { sub: 'nobody@nodomain.xyz' };
      const authState: AuthState = {
        accessToken: {
          accessToken: ACCESS_TOKEN,
          claims: userClaims,
          tokenType: 'access token',
          userinfoUrl: 'some url',
          expiresAt: 3487781,
          authorizeUrl: '',
          scopes: [''],
        },
      };
      expect(getValidatedClaims(authState)).toEqual(userClaims);
    });

    test('should return empty object', () => {
      expect(getValidatedClaims(null)).toEqual({});
    });
  });

  describe('refreshOktaToken', () => {
    let oktaAuth: OktaAuth;

    const userClaims: UserClaims = {
      sub: 'nobody@nodomain.xyz',
      name: 'mock user',
      exp: EXPIRATION_SECONDS,
    };
    const getUser = vi.spyOn(OktaAuth.prototype, 'getUser');
    const getOrRenewAccessToken = vi.spyOn(OktaAuth.prototype, 'getOrRenewAccessToken');
    const getAuthState = vi.spyOn(AuthStateManager.prototype, 'getAuthState');

    const camsSession = {
      provider: 'okta',
      apiToken: ACCESS_TOKEN,
      user: { name: 'mock user' },
      validatedClaims: userClaims,
    };
    const getSession = vi.spyOn(LocalStorage, 'getSession');
    const setSession = vi.spyOn(LocalStorage, 'setSession');

    const isTokenBeingRefreshedSpy = vi.spyOn(LocalStorage, 'isTokenBeingRefreshed');
    const setRefreshingTokenSpy = vi.spyOn(LocalStorage, 'setRefreshingToken');
    const removeRefreshingTokenSpy = vi.spyOn(LocalStorage, 'removeRefreshingToken');

    beforeEach(() => {
      vi.clearAllMocks();
      oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
    });

    test('should do nothing if a session does not exist', async () => {
      getSession.mockReturnValue(null);
      await refreshOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should do nothing if verified claims does not include an expiration', async () => {
      getSession.mockReturnValue(camsSession);
      await refreshOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should do nothing if the expiration is not set to expire soon', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(WAY_BEFORE_EXPIRATION);
      await refreshOktaToken(oktaAuth);

      expect(getSession).toHaveBeenCalled();
      expect(setSession).not.toHaveBeenCalled();
    });

    test('should refresh the access token', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);

      const refreshedAccessToken: AccessToken = {
        claims: { ...userClaims, exp: NEW_EXPIRATION },
      } as unknown as AccessToken;

      getSession.mockReturnValue(camsSession);
      getAuthState.mockReturnValueOnce({ isAuthenticated: true }).mockReturnValue({
        isAuthenticated: true,
        accessToken: refreshedAccessToken,
      });
      getOrRenewAccessToken.mockResolvedValue(REFRESHED_ACCESS_TOKEN);
      getUser.mockResolvedValue({ ...userClaims, exp: NEW_EXPIRATION });

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      await refreshOktaToken(oktaAuth);

      await waitFor(() => {
        return removeRefreshingTokenSpy.mock.calls.length > 0;
      });
      expect(getAuthState).toHaveBeenCalled();
      expect(getOrRenewAccessToken).toHaveBeenCalled();
      expect(getUser).toHaveBeenCalled();

      expect(isTokenBeingRefreshedSpy).toHaveBeenCalled();
      expect(setRefreshingTokenSpy).toHaveBeenCalled();
      expect(removeRefreshingTokenSpy).toHaveBeenCalled();

      expect(getSession).toHaveBeenCalled();
      expect(setSession).toHaveBeenCalledWith({
        provider: 'okta',
        apiToken: REFRESHED_ACCESS_TOKEN,
        user: { name: 'mock user' },
        validatedClaims: refreshedAccessToken.claims,
      });
    });

    test('should refresh the access token after it has expired', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(AFTER_EXPIRATION);

      getSession.mockReturnValue(camsSession);
      getAuthState.mockReturnValue({ isAuthenticated: true });
      getUser.mockResolvedValue(userClaims);

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      await refreshOktaToken(oktaAuth);

      await waitFor(() => {
        return removeRefreshingTokenSpy.mock.calls.length > 0;
      });
      expect(setSession).toHaveBeenCalled();
      expect(setRefreshingTokenSpy).toHaveBeenCalled();
      expect(removeRefreshingTokenSpy).toHaveBeenCalled();
    });

    test('should do nothing if an error is encountered', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);
      getAuthState.mockReturnValue({ isAuthenticated: true });
      getOrRenewAccessToken.mockRejectedValue(new Error('some error calling Okta'));

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      await refreshOktaToken(oktaAuth);

      await waitFor(() => {
        return removeRefreshingTokenSpy.mock.calls.length > 0;
      });
      expect(setSession).not.toHaveBeenCalled();
      expect(setRefreshingTokenSpy).toHaveBeenCalled();
      expect(removeRefreshingTokenSpy).toHaveBeenCalled();
    });

    test('should do nothing the state is unauthenticated', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(JUST_BEFORE_EXPIRATION);
      getAuthState.mockReturnValue({ isAuthenticated: false });

      const oktaAuth = new OktaAuth(MOCK_OAUTH_CONFIG);
      await refreshOktaToken(oktaAuth);

      await waitFor(() => {
        return removeRefreshingTokenSpy.mock.calls.length > 0;
      });
      expect(setSession).not.toHaveBeenCalled();
      expect(setRefreshingTokenSpy).toHaveBeenCalled();
      expect(removeRefreshingTokenSpy).toHaveBeenCalled();
    });
  });
});
