import { CamsJwtHeader } from '../../types/authorization';
import * as Verifier from './HumbleVerifier';
import { UnauthorizedError } from '../../../common-errors/unauthorized-error';
import MockFetch from '../../../testing/mock-fetch';
import { ApplicationContext } from '../../types/basic';
import { createMockApplicationContext } from '../../../testing/testing-utilities';
import OktaGateway from './okta-gateway';

describe('Okta gateway tests', () => {
  let context: ApplicationContext;
  const gateway = OktaGateway;

  beforeEach(async () => {
    context = await createMockApplicationContext({
      AUTH_ISSUER: undefined,
      MOCK_AUTH: undefined,
    });
    context.config.authConfig.provider = null;
    context.config.authConfig.issuer = null;
    context.config.authConfig.audience = null;
    context.config.authConfig.userInfoUri = null;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('Should receive invalid provider error', async () => {
    context.config.authConfig.provider = 'mock';
    await expect(gateway.verifyToken('test')).rejects.toThrow('Invalid provider.');
  });

  test('Should receive invalid issuer error', async () => {
    context.config.authConfig.issuer = null;
    context.config.authConfig.provider = 'okta';
    await expect(gateway.verifyToken('test')).rejects.toThrow('Issuer not provided.');
  });

  test('Should receive invalid audience error', async () => {
    context.config.authConfig.audience = null;
    context.config.authConfig.provider = 'okta';
    context.config.authConfig.issuer = 'https://fake.okta.com/';
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
      header: jwtHeader as CamsJwtHeader,
      toString: jest.fn(),
      isExpired: jest.fn(),
      isNotBefore: jest.fn(),
    };
    jest.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(jwt);
    context.config.authConfig.provider = 'okta';
    context.config.authConfig.issuer = 'https://fake.okta.com/oauth2/default';
    context.config.authConfig.audience = 'api://default';
    const actual = await gateway.verifyToken(token);
    expect(actual).toEqual(jwt);
  });

  test('Should throw UnauthorizedError if not given valid input ', async () => {
    const token = 'testToken';
    jest.spyOn(Verifier, 'verifyAccessToken').mockRejectedValue(new Error('Test error'));
    context.config.authConfig.provider = 'okta';
    context.config.authConfig.issuer = 'https://fake.okta.com/oauth2/default';
    context.config.authConfig.audience = 'api://default';
    await expect(gateway.verifyToken(token)).rejects.toThrow('Unauthorized');
  });

  test('getUser should return a valid response with user.name', async () => {
    const userInfo = {
      name: 'Test Name',
      testAttribute: '',
    };
    const mockFetchResponse = MockFetch.ok(userInfo);
    jest.spyOn(global, 'fetch').mockImplementation(mockFetchResponse);
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
    await expect(gateway.getUser('testAccessToken')).rejects.toThrow(UnauthorizedError);
  });

  test('getUser should throw UnauthorizedError if fetch errors', async () => {
    const mockFetch = MockFetch.throws(new Error('Some unknown error'));
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
    await expect(gateway.getUser('testAccessToken')).rejects.toThrow(UnauthorizedError);
  });
});
