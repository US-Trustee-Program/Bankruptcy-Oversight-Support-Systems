import { ConflictError, isConflictError, UserSessionUseCase } from './user-session';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockHumbleItems, MockHumbleQuery } from '../../testing/mock.cosmos-client-humble';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import * as factoryModule from '../../factory';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CamsSession } from '../../../../../common/src/cams/session';
import { CamsRole } from '../../../../../common/src/cams/roles';
import { urlRegex } from '../../../../../common/src/cams/test-utilities/regex';
import { CamsJwtHeader } from '../../../../../common/src/cams/jwt';
import { UserSessionCacheCosmosDbRepository } from '../../adapters/gateways/user-session-cache.cosmosdb.repository';
import MockOpenIdConnectGateway from '../../testing/mock-gateways/mock-oauth2-gateway';
import * as Verifier from '../../adapters/gateways/okta/HumbleVerifier';
import { REGION_02_GROUP_NY } from '../../../../../common/src/cams/test-utilities/mock-user';

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

  beforeEach(async () => {
    gateway = new UserSessionUseCase();
    context = await createMockApplicationContext({
      env: { CAMS_LOGIN_PROVIDER: 'okta', CAMS_LOGIN_PROVIDER_CONFIG: 'something' },
    });

    const jwtHeader = {
      alg: 'RS256',
      typ: undefined,
      kid: '',
    };
    const camsJwt = {
      claims,
      header: jwtHeader as CamsJwtHeader,
    };
    jest.spyOn(Verifier, 'verifyAccessToken').mockResolvedValue(camsJwt);
    jest
      .spyOn(MockOpenIdConnectGateway, 'getUser')
      .mockResolvedValue({ user: mockUser, jwt: camsJwt });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return valid session and add to cache when cache miss is encountered', async () => {
    jest.spyOn(UserSessionCacheCosmosDbRepository.prototype, 'get').mockResolvedValue(null);
    const createSpy = jest
      .spyOn(UserSessionCacheCosmosDbRepository.prototype, 'put')
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
    jest
      .spyOn(UserSessionCacheCosmosDbRepository.prototype, 'get')
      .mockResolvedValue(expectedSession);
    const createSpy = jest
      .spyOn(UserSessionCacheCosmosDbRepository.prototype, 'put')
      .mockRejectedValue('We should not call this function.');
    const session = await gateway.lookup(context, jwtString, provider);
    expect(session).toEqual({
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should not add anything to cache if token is invalid', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    jest
      .spyOn(MockOpenIdConnectGateway, 'getUser')
      .mockRejectedValue(new UnauthorizedError('test-module'));
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should handle null jwt from authGateway', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockResolvedValue({
      user: mockUser,
      jwt: null,
    });
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
  });

  test('should handle undefined jwt from authGateway', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockResolvedValue({
      user: mockUser,
      jwt: undefined,
    });
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
  });

  test('should return valid session and NOT add to cache when Conflict error is received', async () => {
    const conflictError: ConflictError = {
      code: 409,
      body: {
        code: 'Conflict',
        message:
          'Entity with the specified id already exists in the system. Other unimportant text...',
      },
      headers: {
        one: 1,
        two: 'two',
      },
      activityId: 'activity',
    };
    jest
      .spyOn(UserSessionCacheCosmosDbRepository.prototype, 'get')
      .mockResolvedValueOnce(null)
      .mockResolvedValue(mockCamsSession);
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockRejectedValue(conflictError);
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    const session = await gateway.lookup(context, jwtString, provider);
    expect(session).toEqual({
      ...mockCamsSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should properly identify Conflict error', () => {
    const error: ConflictError = {
      code: 409,
      body: {
        code: 'Conflict',
        message:
          'Entity with the specified id already exists in the system. Other unimportant text...',
      },
      headers: {
        one: 1,
        two: 'two',
      },
      activityId: 'activity',
    };
    expect(isConflictError(error)).toBeTruthy();
  });

  test('should throw UnauthorizedError if unknown error is encountered', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    jest.spyOn(MockOpenIdConnectGateway, 'getUser').mockRejectedValue(new Error('Test error'));
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(UnauthorizedError);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should throw ServerConfigError if factory does not return an OidcConnectGateway', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue(null);
    await expect(gateway.lookup(context, jwtString, provider)).rejects.toThrow(ServerConfigError);
  });

  test('should use legacy behavior if restrict-case-assignment feature flag is not set', async () => {
    jest.spyOn(factoryModule, 'getUserSessionCacheRepository').mockReturnValue({
      put: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
    });

    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue(MockOpenIdConnectGateway);

    const localContext = { ...context, featureFlags: { ...context.featureFlags } };
    localContext.featureFlags['restrict-case-assignment'] = false;

    const session = await gateway.lookup(localContext, jwtString, provider);
    expect(session.user.offices).toEqual([REGION_02_GROUP_NY]);
    expect(session.user.roles).toEqual([CamsRole.CaseAssignmentManager]);
  });
});
