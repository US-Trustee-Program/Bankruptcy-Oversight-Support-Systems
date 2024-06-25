import { getAuthorizationGateway } from '../../../factory';
import * as AuthConfig from '../../../configs/authorization-configuration';
import { JwtHeader } from '../../types/authorization';
import * as Verifier from './HumbleVerifier';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import MockFetch from '../../../testing/mock-fetch';

describe('Okta gateway tests', () => {
  beforeEach(() => {
    jest.spyOn(AuthConfig, 'getAuthorizationConfig').mockReturnValue({
      issuer: 'https://fake.okta.com/oauth2/default',
      audience: 'api://default',
      provider: 'okta',
      userInfoUri: 'https://fake.provider.com/oauth2/default/v1/userinfo',
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('Should receive invalid provider error', async () => {
    jest.spyOn(AuthConfig, 'getAuthorizationConfig').mockReturnValue({
      issuer: 'https://fake.provider.com/oauth2/default',
      audience: 'api://default',
      provider: null,
      userInfoUri: 'https://fake.provider.com/oauth2/default/v1/userinfo',
    });
    const gateway = getAuthorizationGateway('okta');
    await expect(gateway.verifyToken('test')).rejects.toThrow('Invalid provider.');
  });

  test('Should receive invalid issuer error', async () => {
    jest.spyOn(AuthConfig, 'getAuthorizationConfig').mockReturnValue({
      issuer: undefined,
      audience: 'api://default',
      provider: 'okta',
      userInfoUri: 'https://fake.provider.com/oauth2/default/v1/userinfo',
    });
    const gateway = getAuthorizationGateway('okta');
    await expect(gateway.verifyToken('test')).rejects.toThrow('Issuer not provided.');
  });

  test('Should receive invalid audience error', async () => {
    jest.spyOn(AuthConfig, 'getAuthorizationConfig').mockReturnValue({
      issuer: 'https://fake.okta.com/oauth2/default',
      audience: undefined,
      provider: 'okta',
      userInfoUri: 'https://fake.provider.com/oauth2/default/v1/userinfo',
    });
    const gateway = getAuthorizationGateway('okta');
    await expect(gateway.verifyToken('test')).rejects.toThrow('Audience not provided.');
  });

  test('Should return valid Jwt when given valid token and audience', async () => {
    const token = 'testToken';
    const jwtClaims = {
      iss: 'https://fake.okta.com/oauth2/default',
      sub: 'user@fake.com',
      aud: 'api://default',
      iat: 0,
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const jwtHeader = {
      alg: 'RS256',
      typ: undefined,
      kid: '',
    };
    const jwt = {
      claims: jwtClaims,
      header: jwtHeader as JwtHeader,
      toString: jest.fn(),
      isExpired: jest.fn(),
      isNotBefore: jest.fn(),
    };
    jest.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(jwt);
    const gateway = getAuthorizationGateway('okta');
    const actual = await gateway.verifyToken(token);
    expect(actual).toEqual(jwt);
  });

  test('Should throw UnauthorizedError if not given valid input ', async () => {
    const token = 'testToken';
    jest.spyOn(Verifier, 'verifyAccessToken').mockRejectedValue(new Error('Test error'));
    const gateway = getAuthorizationGateway('okta');
    await expect(gateway.verifyToken(token)).rejects.toThrow('Unauthorized');
  });

  test('getUser should return a valid response with user.name', async () => {
    const userInfo = {
      name: 'Test Name',
      testAttribute: '',
    };
    const mockFetchResponse = MockFetch.ok(userInfo);
    jest.spyOn(global, 'fetch').mockImplementation(mockFetchResponse);
    const gateway = getAuthorizationGateway('okta');
    const actualResponse = await gateway.getUser('testAccessToken');

    expect(actualResponse).not.toEqual(expect.objectContaining({ testAttribute: '' }));
    expect(actualResponse).toEqual(expect.objectContaining({ name: 'Test Name' }));
  });

  test('getUser should throw Error if call failed', async () => {
    const userInfo = {
      name: 'Test Name',
      testAttribute: '',
    };
    const mockFetch = MockFetch.notOk(userInfo);
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
    const gateway = getAuthorizationGateway('okta');
    await expect(gateway.getUser('testAccessToken')).rejects.toThrow(UnauthorizedError);
  });

  test('getUser should throw UnauthorizedError if fetch errors', async () => {
    const mockFetch = MockFetch.throws(new Error('Some unknown error'));
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
    const gateway = getAuthorizationGateway('okta');
    await expect(gateway.getUser('testAccessToken')).rejects.toThrow(UnauthorizedError);
  });
});
