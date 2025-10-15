import { UserSessionUseCase } from './user-session';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import * as factoryModule from '../../factory';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CamsSession } from '../../../../common/src/cams/session';
import { urlRegex } from '../../../../common/src/cams/test-utilities/regex';
import { CamsJwtHeader } from '../../../../common/src/cams/jwt';
import MockOpenIdConnectGateway from '../../testing/mock-gateways/mock-oauth2-gateway';
import * as Verifier from '../../adapters/gateways/okta/HumbleVerifier';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { NotFoundError } from '../../common-errors/not-found-error';
import UsersHelpers from '../users/users.helpers';
import * as delayModule from '../../../../common/src/delay';

describe('user-session.gateway test', () => {
  const jwtString = MockData.getJwt();
  const claims = {
    iss: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'api://default',
    iat: 0,
    exp: Number.MAX_SAFE_INTEGER,
    groups: [],
  };
  const provider = 'okta';
  const mockUser = MockData.getCamsUser();
  const expectedSession = MockData.getCamsSession({
    user: mockUser,
    accessToken: jwtString,
    provider,
  });

  const mockCamsSession: CamsSession = {
    user: { id: 'userId-Wrong Name', name: 'Wrong Name' },
    accessToken: jwtString,
    provider,
    issuer: 'http://issuer/',
    expires: Number.MAX_SAFE_INTEGER,
  };
  let context: ApplicationContext;
  let gateway: UserSessionUseCase;

  const jwtHeader = {
    alg: 'RS256',
    typ: undefined,
    kid: '',
  };
  const camsJwt = {
    claims,
    header: jwtHeader as CamsJwtHeader,
  };

  beforeEach(async () => {
    gateway = new UserSessionUseCase();
    context = await createMockApplicationContext({
      env: { CAMS_LOGIN_PROVIDER: 'okta', CAMS_LOGIN_PROVIDER_CONFIG: 'something' },
    });
    context.featureFlags['privileged-identity-management'] = true;

    jest.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(camsJwt);
    jest
      .spyOn(MockOpenIdConnectGateway, 'getUser')
      .mockResolvedValue({ user: mockUser, jwt: camsJwt });
    jest.spyOn(UsersHelpers, 'getPrivilegedIdentityUser').mockResolvedValue(expectedSession.user);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return valid session and add to cache when cache miss is encountered', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    const getUser = jest.fn().mockResolvedValue({ user: mockUser, jwt: camsJwt });
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue({ getUser });
    jest.spyOn(UsersHelpers, 'getPrivilegedIdentityUser').mockResolvedValue(expectedSession.user);
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(mockCamsSession);
    const session = await gateway.lookup(context, jwtString, provider);
    expect(session).toEqual({
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(createSpy).toHaveBeenCalled();
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  test('should return valid session on cache hit', async () => {
    const expected = {
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    };
    jest.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(expected);
    const createSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockRejectedValue('We should not call this function.');
    const session = await gateway.lookup(context, jwtString, provider);
    expect(session).toEqual(expected);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should not add anything to cache if token is invalid', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    const getUser = jest.fn().mockRejectedValue(new UnauthorizedError('test-module'));
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue({ getUser });
    const delaySpy = jest.spyOn(delayModule, 'delay').mockResolvedValue(undefined);
    const createSpy = jest.spyOn(MockMongoRepository.prototype, 'create');
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
    expect(getUser).toHaveBeenCalledTimes(3);
    expect(delaySpy).toHaveBeenCalledTimes(2);
  });

  test('should handle null jwt from authGateway', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    const getUser = jest.fn().mockResolvedValue({ user: mockUser, jwt: null });
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue({ getUser });
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
  });

  test('should handle undefined jwt from authGateway', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    const getUser = jest.fn().mockResolvedValue({ user: mockUser, jwt: undefined });
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue({ getUser });
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
  });

  test('should throw UnauthorizedError if unknown error is encountered', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new UnauthorizedError(''));
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockRejectedValue(new Error('Test error'));
    const createSpy = jest.spyOn(MockMongoRepository.prototype, 'create');
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should throw ServerConfigError if factory does not return an OidcConnectGateway', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue(null);
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(ServerConfigError);
  });

  test('should retry identity provider call and succeed after transient failures', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    const delaySpy = jest.spyOn(delayModule, 'delay').mockResolvedValue(undefined);
    const getUser = jest
      .fn()
      .mockRejectedValueOnce(new UnauthorizedError('Transient error 1'))
      .mockRejectedValueOnce(new UnauthorizedError('Transient error 2'))
      .mockResolvedValue({ user: mockUser, jwt: camsJwt });
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue({ getUser });
    jest.spyOn(UsersHelpers, 'getPrivilegedIdentityUser').mockResolvedValue(expectedSession.user);
    const upsertSpy = jest
      .spyOn(MockMongoRepository.prototype, 'upsert')
      .mockResolvedValue(mockCamsSession);

    const session = await gateway.lookup(context, jwtString, provider);
    expect(session).toEqual({
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(getUser).toHaveBeenCalledTimes(3);
    expect(delaySpy).toHaveBeenCalledTimes(2);
    expect(delaySpy).toHaveBeenNthCalledWith(1, 2000);
    expect(delaySpy).toHaveBeenNthCalledWith(2, 4000);
    expect(upsertSpy).toHaveBeenCalled();
  });

  test('should throw after max retries from identity provider', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    const delaySpy = jest.spyOn(delayModule, 'delay').mockResolvedValue(undefined);
    const getUser = jest.fn().mockImplementation(() => {
      throw new UnauthorizedError('Persistent error');
    });
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue({ getUser });
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
    expect(getUser).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(delaySpy).toHaveBeenCalledTimes(2);
    expect(delaySpy).toHaveBeenNthCalledWith(1, 2000);
    expect(delaySpy).toHaveBeenNthCalledWith(2, 4000);
  });
});
