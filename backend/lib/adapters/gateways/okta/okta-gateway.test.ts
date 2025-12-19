import { vi } from 'vitest';
import * as Verifier from './HumbleVerifier';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import MockFetch from '../../../testing/mock-fetch';
import OktaGateway from './okta-gateway';
import { CamsJwtHeader } from '../../../../../common/src/cams/jwt';
import * as AuthorizationConfiguration from '../../../configs/authorization-configuration';
import { AuthorizationConfig } from '../../types/authorization';
import DateHelper from '../../../../../common/src/date-helper';
import * as camsJwtModule from '../../../../../common/src/cams/jwt';
import { isCamsError } from '../../../common-errors/cams-error';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import { ApplicationContext } from '../../types/basic';

const { nowInSeconds } = DateHelper;

describe('Okta gateway tests', () => {
  const gateway = OktaGateway;
  let context: ApplicationContext;

  beforeEach(async () => {
    const authConfig: AuthorizationConfig = {
      issuer: 'something',
      provider: 'okta',
      audience: 'something',
      userInfoUri: 'something',
    };
    vi.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test.each([
    [
      'invalid provider',
      { issuer: 'something', provider: 'mock', audience: 'something', userInfoUri: 'something' },
      'Invalid provider.',
    ],
    [
      'invalid issuer',
      { issuer: null, provider: 'okta', audience: 'something', userInfoUri: 'something' },
      'Issuer not provided.',
    ],
    [
      'invalid audience',
      { issuer: 'something', provider: 'okta', audience: null, userInfoUri: 'something' },
      'Audience not provided.',
    ],
  ])('Should receive %s error', async (_desc, authConfig, expectedError) => {
    vi.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    await expect(gateway.getUser(context, 'test')).rejects.toThrow(expectedError);
  });

  test('Should return valid user with Jwt when given valid token and audience', async () => {
    const token = 'testToken';
    const jwtClaims = {
      iss: 'https://fake.okta.com/oauth2/default',
      sub: 'user@fake.com',
      aud: 'api://default',
      iat: 0,
      exp: nowInSeconds() + 600,
      AD_Groups: ['groupD'],
      ad_groups: ['groupA', 'groupB'],
      groups: ['groupB', 'groupC'],
    };
    const jwtHeader = {
      alg: 'RS256',
      typ: undefined,
      kid: '',
    };
    const jwt = {
      claims: jwtClaims,
      header: jwtHeader as CamsJwtHeader,
      toString: vi.fn(),
      isExpired: vi.fn(),
      isNotBefore: vi.fn(),
    };
    vi.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(jwt);
    const userInfo = {
      name: 'Test Name',
      testAttribute: '',
    };
    const mockFetchResponse = MockFetch.ok(userInfo);
    vi.spyOn(global, 'fetch').mockImplementation(mockFetchResponse);
    const actual = await gateway.getUser(context, token);
    expect(actual).toEqual({
      user: { id: undefined, name: userInfo.name },
      jwt: {
        ...jwt,
        claims: {
          ...jwt.claims,
          groups: expect.arrayContaining(['groupA', 'groupB', 'groupC', 'groupD']),
        },
      },
    });
  });

  test('should throw UnauthorizedError if not given valid input', async () => {
    const token = 'testToken';
    vi.spyOn(Verifier, 'verifyAccessToken').mockRejectedValue(new Error('Test error'));
    await expect(gateway.getUser(context, token)).rejects.toThrow('Unauthorized');
  });

  test('getUser should throw Error if call failed', async () => {
    const userInfo = {
      name: 'Test Name',
      testAttribute: '',
    };
    const mockFetch = MockFetch.notOk(userInfo);
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch);
    await expect(gateway.getUser(context, 'testAccessToken')).rejects.toThrow(UnauthorizedError);
  });

  test('getUser should throw UnauthorizedError if fetch errors', async () => {
    const mockFetch = MockFetch.throws(new Error('Some unknown error'));
    vi.spyOn(global, 'fetch').mockImplementation(mockFetch);
    await expect(gateway.getUser(context, 'testAccessToken')).rejects.toThrow(UnauthorizedError);
  });

  test('should retry verifyAccessTokenWithRetry on ECONNRESET', async () => {
    const token = 'testToken';
    const authConfig: AuthorizationConfig = {
      issuer: 'something',
      provider: 'okta',
      audience: 'something',
      userInfoUri: 'something',
    };
    vi.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    const ECONNRESET_ERROR = {
      name: 'JwtParseError',
      message: 'ECONNRESET',
      userMessage: 'ECONNRESET',
      jwtString: '',
      parsedHeader: {},
      parsedBody: {},
      innerError: { errno: 104, code: 'ECONNRESET', syscall: 'read' },
    };
    const jwt = {
      claims: {
        iss: 'issuer',
        sub: 'sub',
        aud: 'aud',
        exp: nowInSeconds() + 600,
        groups: ['groupA'],
      },
      header: { typ: 'JWT' },
      toString: vi.fn(),
      isExpired: vi.fn(),
      isNotBefore: vi.fn(),
    };
    const verifySpy = vi
      .spyOn(Verifier, 'verifyAccessToken')
      .mockRejectedValueOnce(ECONNRESET_ERROR)
      .mockResolvedValueOnce(jwt);
    const userInfo = {
      name: 'Test Name',
      sub: 'id',
      locale: '',
      email: '',
      preferred_username: '',
      given_name: '',
      family_name: '',
      zoneinfo: '',
      updated_at: 0,
      email_verified: true,
    };
    vi.spyOn(global, 'fetch').mockImplementation(MockFetch.ok(userInfo));
    const actual = await OktaGateway.getUser(context, token);
    expect(actual.user.name).toBe(userInfo.name);
    expect(verifySpy).toHaveBeenCalledTimes(2);
  });

  test('Should retry verifyAccessToken on ECONNRESET JwtParseError and succeed', async () => {
    const token = 'testToken';
    const jwtClaims = {
      iss: 'https://fake.okta.com/oauth2/default',
      sub: 'user@fake.com',
      aud: 'api://default',
      iat: 0,
      exp: nowInSeconds() + 600,
      groups: ['groupB'],
    };
    const jwtHeader = { alg: 'RS256', typ: undefined, kid: '' };
    const jwt = {
      claims: jwtClaims,
      header: jwtHeader as CamsJwtHeader,
      toString: vi.fn(),
      isExpired: vi.fn(),
      isNotBefore: vi.fn(),
    };
    let callCount = 0;
    vi.spyOn(Verifier, 'verifyAccessToken').mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        throw {
          name: 'JwtParseError',
          message: 'ECONNRESET',
          userMessage: '',
          jwtString: '',
          parsedHeader: {},
          parsedBody: {},
          innerError: { errno: 123, code: 'ECONNRESET', syscall: 'read' },
        };
      }
      return jwt;
    });
    const userInfo = { name: 'Retry User' };
    vi.spyOn(global, 'fetch').mockImplementation(MockFetch.ok(userInfo));
    const actual = await gateway.getUser(context, token);
    expect(actual.user.name).toBe('Retry User');
    expect(callCount).toBe(2);
  });

  test('should throw UnauthorizedError if isCamsJwt returns false', async () => {
    const token = 'testToken';
    const authConfig: AuthorizationConfig = {
      issuer: 'something',
      provider: 'okta',
      audience: 'something',
      userInfoUri: 'something',
    };
    vi.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    const jwt = {
      claims: {
        iss: 'issuer',
        sub: 'sub',
        aud: 'aud',
        exp: nowInSeconds() + 600,
        groups: ['groupA'],
      },
      header: { typ: 'JWT' },
      toString: vi.fn(),
      isExpired: vi.fn(),
      isNotBefore: vi.fn(),
    };
    vi.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(jwt);
    // Patch isCamsJwt to return false
    vi.spyOn(camsJwtModule, 'isCamsJwt').mockReturnValue(false);
    await expect(OktaGateway.getUser(context, token)).rejects.toThrow('Unable to verify token.');
  });

  test('should throw UnauthorizedError if claims.groups is missing', async () => {
    const token = 'testToken';
    const authConfig: AuthorizationConfig = {
      issuer: 'something',
      provider: 'okta',
      audience: 'something',
      userInfoUri: 'something',
    };
    vi.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    const jwt = {
      claims: {
        iss: 'issuer',
        sub: 'sub',
        aud: 'aud',
        exp: nowInSeconds() + 600,
        // groups missing
      },
      header: { typ: 'JWT' },
      toString: vi.fn(),
      isExpired: vi.fn(),
      isNotBefore: vi.fn(),
    };
    vi.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(jwt);
    // Patch isCamsJwt to return true
    vi.spyOn(camsJwtModule, 'isCamsJwt').mockReturnValue(true);
    await expect(OktaGateway.getUser(context, token)).rejects.toThrow(
      'Access token claims missing groups.',
    );
  });

  test.each([
    ['groups only', { groups: ['groupB', 'groupC'] }, ['groupB', 'groupC']],
    [
      'groups + AD_Groups string',
      { groups: ['groupA', 'groupB'], AD_Groups: 'groupC' },
      ['groupA', 'groupB', 'groupC'],
    ],
    [
      'groups + ad_groups string',
      { groups: ['groupA', 'groupB'], ad_groups: 'groupD' },
      ['groupA', 'groupB', 'groupD'],
    ],
    [
      'groups + Ad_Groups array',
      { groups: ['groupA', 'groupB'], Ad_Groups: ['groupE'] },
      ['groupA', 'groupB', 'groupE'],
    ],
    [
      'groups + AD_Groups array',
      { groups: ['groupA', 'groupB'], AD_Groups: ['groupC', 'groupF'] },
      ['groupA', 'groupB', 'groupC', 'groupF'],
    ],
    [
      'groups + all ad_groups variants',
      {
        groups: ['groupA', 'groupB'],
        AD_Groups: 'groupC',
        ad_groups: 'groupD',
        Ad_Groups: 'groupE',
      },
      ['groupA', 'groupB', 'groupC', 'groupD', 'groupE'],
    ],
    [
      'groups + all ad_groups variants (arrays)',
      {
        groups: ['groupA', 'groupB'],
        AD_Groups: ['groupC', 'groupF'],
        ad_groups: 'groupD',
        Ad_Groups: ['groupE'],
      },
      ['groupA', 'groupB', 'groupC', 'groupF', 'groupD', 'groupE'],
    ],
    [
      'groups + ad_groups as number/object',
      { groups: ['groupA'], ad_groups: 123, AD_Groups: { custom: 'value' } },
      ['groupA', 123, { custom: 'value' }],
    ],
  ])(
    'should merge %s into groups and ensure uniqueness',
    async (_desc, groupClaims, expectedGroups) => {
      const token = 'testToken';
      const jwtClaims = {
        iss: 'https://fake.okta.com/oauth2/default',
        sub: 'user@fake.com',
        aud: 'api://default',
        iat: 0,
        exp: nowInSeconds() + 600,
        ...groupClaims,
      };
      const jwtHeader = { alg: 'RS256', typ: undefined, kid: '' };
      const jwt = {
        claims: jwtClaims,
        header: jwtHeader as CamsJwtHeader,
        toString: vi.fn(),
        isExpired: vi.fn(),
        isNotBefore: vi.fn(),
      };
      vi.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(jwt);
      vi.spyOn(camsJwtModule, 'isCamsJwt').mockReturnValue(true);
      const userInfo = {
        name: 'Test Name',
        sub: 'id',
        locale: '',
        email: '',
        preferred_username: '',
        given_name: '',
        family_name: '',
        zoneinfo: '',
        updated_at: 0,
        email_verified: true,
      };
      vi.spyOn(global, 'fetch').mockImplementation(MockFetch.ok(userInfo));
      const actual = await OktaGateway.getUser(context, token);
      expect(actual.jwt.claims.groups).toEqual(expect.arrayContaining(expectedGroups));
      expect(new Set(actual.jwt.claims.groups).size).toBe(actual.jwt.claims.groups.length);
    },
  );

  test.each([
    [
      'fetch not ok and bodyUsed false',
      async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: false,
          bodyUsed: false,
          text: vi.fn(),
        });
        vi.spyOn(global, 'fetch').mockImplementation(mockFetch);
      },
      UnauthorizedError,
      'Failed to retrieve user info from Okta. No response body',
    ],
    [
      'fetch throws error',
      async () => {
        const mockFetch = MockFetch.throws(new Error('Some unknown error'));
        vi.spyOn(global, 'fetch').mockImplementation(mockFetch);
      },
      UnauthorizedError,
      'Some unknown error',
    ],
  ])('getUser should handle %s', async (_desc, setupFetch, expectedError, expectedMsg) => {
    const token = 'testToken';
    const jwtClaims = {
      iss: 'https://fake.okta.com/oauth2/default',
      sub: 'user@fake.com',
      aud: 'api://default',
      iat: 0,
      exp: nowInSeconds() + 600,
      groups: ['groupB', 'groupC'],
    };
    const jwtHeader = { alg: 'RS256', typ: undefined, kid: '' };
    const jwt = {
      claims: jwtClaims,
      header: jwtHeader as CamsJwtHeader,
      toString: vi.fn(),
      isExpired: vi.fn(),
      isNotBefore: vi.fn(),
    };
    vi.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(jwt);
    vi.spyOn(camsJwtModule, 'isCamsJwt').mockReturnValue(true);
    await setupFetch();
    const call = OktaGateway.getUser(context, token);
    await expect(call).rejects.toThrow(expectedError);
    await expect(call).rejects.toThrow(expectedMsg);
  });

  test('should throw UnauthorizedError if verifyAccessToken throws non-CamsError', async () => {
    vi.spyOn(Verifier, 'verifyAccessToken').mockImplementation(async () => {
      throw new Error('Some random error');
    });
    await expect(gateway.getUser(context, 'token')).rejects.toThrow(UnauthorizedError);
  });

  test('should rethrow original error if isCamsError returns true in getUser catch', async () => {
    const token = 'testToken';
    const camsError = new UnauthorizedError('OKTA-GATEWAY', { message: 'cams error' });
    vi.spyOn(Verifier, 'verifyAccessToken').mockImplementation(async () => {
      throw camsError;
    });
    // Patch isCamsError to return true
    vi.spyOn({ isCamsError }, 'isCamsError').mockReturnValue(true);
    await expect(OktaGateway.getUser(context, token)).rejects.toBe(camsError);
  });
});
