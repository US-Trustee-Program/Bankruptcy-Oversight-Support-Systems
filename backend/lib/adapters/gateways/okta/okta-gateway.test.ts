import { CamsJwtHeader } from '../../../../../common/src/cams/jwt';
import { nowInSeconds } from '../../../../../common/src/date-helper';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import * as AuthorizationConfiguration from '../../../configs/authorization-configuration';
import MockFetch from '../../../testing/mock-fetch';
import { AuthorizationConfig } from '../../types/authorization';
import * as Verifier from './HumbleVerifier';
import OktaGateway from './okta-gateway';

describe('Okta gateway tests', () => {
  const gateway = OktaGateway;

  beforeEach(() => {
    const authConfig: AuthorizationConfig = {
      audience: 'something',
      issuer: 'something',
      provider: 'okta',
      userInfoUri: 'something',
    };
    jest.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('Should receive invalid provider error', async () => {
    const authConfig: AuthorizationConfig = {
      audience: 'something',
      issuer: 'something',
      provider: 'mock',
      userInfoUri: 'something',
    };
    jest.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    await expect(gateway.getUser('test')).rejects.toThrow('Invalid provider.');
  });

  test('Should receive invalid issuer error', async () => {
    const authConfig: AuthorizationConfig = {
      audience: 'something',
      issuer: null,
      provider: 'okta',
      userInfoUri: 'something',
    };
    jest.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    await expect(gateway.getUser('test')).rejects.toThrow('Issuer not provided.');
  });

  test('Should receive invalid audience error', async () => {
    const authConfig: AuthorizationConfig = {
      audience: null,
      issuer: 'something',
      provider: 'okta',
      userInfoUri: 'something',
    };
    jest.spyOn(AuthorizationConfiguration, 'getAuthorizationConfig').mockReturnValue(authConfig);
    await expect(gateway.getUser('test')).rejects.toThrow('Audience not provided.');
  });

  test('Should return valid user with Jwt when given valid token and audience', async () => {
    const token = 'testToken';
    const jwtClaims = {
      AD_Groups: ['groupD'],
      ad_groups: ['groupA', 'groupB'],
      aud: 'api://default',
      exp: nowInSeconds() + 600,
      groups: ['groupB', 'groupC'],
      iat: 0,
      iss: 'https://fake.okta.com/oauth2/default',
      sub: 'user@fake.com',
    };
    const jwtHeader = {
      alg: 'RS256',
      kid: '',
      typ: undefined,
    };
    const jwt = {
      claims: jwtClaims,
      header: jwtHeader as CamsJwtHeader,
      isExpired: jest.fn(),
      isNotBefore: jest.fn(),
      toString: jest.fn(),
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
      jwt: {
        ...jwt,
        claims: {
          ...jwt.claims,
          groups: expect.arrayContaining(['groupA', 'groupB', 'groupC', 'groupD']),
        },
      },
      user: { id: undefined, name: userInfo.name },
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
