import * as Verifier from './HumbleVerifier';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import MockFetch from '../../../testing/mock-fetch';
import OktaGateway from './okta-gateway';
import { CamsJwtHeader } from '../../../../../common/src/cams/jwt';
import * as AuthorizationConfiguration from '../../../configs/authorization-configuration';
import { AuthorizationConfig } from '../../types/authorization';

describe('Okta gateway tests', () => {
  const gateway = OktaGateway;

  beforeEach(() => {
    const authConfig: AuthorizationConfig = {
      issuer: 'something',
      provider: 'okta',
      audience: 'something',
      userInfoUri: 'something',
    };
    jest.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('Should receive invalid provider error', async () => {
    const authConfig: AuthorizationConfig = {
      issuer: 'something',
      provider: 'mock',
      audience: 'something',
      userInfoUri: 'something',
    };
    jest.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    await expect(gateway.getUser('test')).rejects.toThrow('Invalid provider.');
  });

  test('Should receive invalid issuer error', async () => {
    const authConfig: AuthorizationConfig = {
      issuer: null,
      provider: 'okta',
      audience: 'something',
      userInfoUri: 'something',
    };
    jest.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    await expect(gateway.getUser('test')).rejects.toThrow('Issuer not provided.');
  });

  test('Should receive invalid audience error', async () => {
    const authConfig: AuthorizationConfig = {
      issuer: 'something',
      provider: 'okta',
      audience: null,
      userInfoUri: 'something',
    };
    jest.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    await expect(gateway.getUser('test')).rejects.toThrow('Audience not provided.');
  });

  test('Should return valid user with Jwt when given valid token and audience', async () => {
    const token = 'testToken';
    const jwtClaims = {
      iss: 'https://fake.okta.com/oauth2/default',
      sub: 'user@fake.com',
      aud: 'api://default',
      iat: 0,
      exp: Math.floor(Date.now() / 1000) + 600,
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
      toString: jest.fn(),
      isExpired: jest.fn(),
      isNotBefore: jest.fn(),
    };
    jest.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(jwt);
    const userInfo = {
      name: 'Test Name',
      testAttribute: '',
    };
    const mockFetchResponse = MockFetch.ok(userInfo);
    jest.spyOn(global, 'fetch').mockImplementation(mockFetchResponse);
    const actual = await gateway.getUser(token);
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
    jest.spyOn(Verifier, 'verifyAccessToken').mockRejectedValue(new Error('Test error'));
    await expect(gateway.getUser(token)).rejects.toThrow('Unauthorized');
  });

  test('getUser should throw Error if call failed', async () => {
    const userInfo = {
      name: 'Test Name',
      testAttribute: '',
    };
    const mockFetch = MockFetch.notOk(userInfo);
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
    await expect(gateway.getUser('testAccessToken')).rejects.toThrow(UnauthorizedError);
  });

  test('getUser should throw UnauthorizedError if fetch errors', async () => {
    const mockFetch = MockFetch.throws(new Error('Some unknown error'));
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
    await expect(gateway.getUser('testAccessToken')).rejects.toThrow(UnauthorizedError);
  });
});
