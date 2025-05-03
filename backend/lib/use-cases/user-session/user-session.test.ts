import { CamsJwtHeader } from '../../../../common/src/cams/jwt';
import { CamsSession } from '../../../../common/src/cams/session';
import { MockData } from '../../../../common/src/cams/test-utilities/mock-data';
import { urlRegex } from '../../../../common/src/cams/test-utilities/regex';
import * as Verifier from '../../adapters/gateways/okta/HumbleVerifier';
import { ApplicationContext } from '../../adapters/types/basic';
import { NotFoundError } from '../../common-errors/not-found-error';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import * as factoryModule from '../../factory';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import MockOpenIdConnectGateway from '../../testing/mock-gateways/mock-oauth2-gateway';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import UsersHelpers from '../users/users.helpers';
import { UserSessionUseCase } from './user-session';

describe('user-session.gateway test', () => {
  const jwtString = MockData.getJwt();
  const claims = {
    aud: 'api://default',
    exp: Number.MAX_SAFE_INTEGER,
    groups: [],
    iat: 0,
    iss: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    sub: 'user@fake.com',
  };
  const provider = 'okta';
  const mockUser = MockData.getCamsUser();
  const expectedSession = MockData.getCamsSession({
    accessToken: jwtString,
    provider,
    user: mockUser,
  });

  const mockCamsSession: CamsSession = {
    accessToken: jwtString,
    expires: Number.MAX_SAFE_INTEGER,
    issuer: 'http://issuer/',
    provider,
    user: { id: 'userId-Wrong Name', name: 'Wrong Name' },
  };
  let context: ApplicationContext;
  let gateway: UserSessionUseCase;

  const jwtHeader = {
    alg: 'RS256',
    kid: '',
    typ: undefined,
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
      .mockResolvedValue({ jwt: camsJwt, user: mockUser });
    jest.spyOn(UsersHelpers, 'getPrivilegedIdentityUser').mockResolvedValue(expectedSession.user);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return valid session and add to cache when cache miss is encountered', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
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
    jest
      .spyOn(MockOpenIdConnectGateway, 'getUser')
      .mockRejectedValue(new UnauthorizedError('test-module'));
    const createSpy = jest.spyOn(MockMongoRepository.prototype, 'create');
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should handle null jwt from authGateway', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockResolvedValue({
      jwt: null,
      user: mockUser,
    });
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
  });

  test('should handle undefined jwt from authGateway', async () => {
    jest.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError(''));
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockResolvedValue({
      jwt: undefined,
      user: mockUser,
    });
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
});
