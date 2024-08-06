import { ConflictError, isConflictError, UserSessionGateway } from './user-session-gateway';
import OktaGateway from './okta/okta-gateway';
import { CamsJwtHeader } from '../types/authorization';
import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import {
  MockHumbleItem,
  MockHumbleItems,
  MockHumbleQuery,
} from '../../testing/mock.cosmos-client-humble';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';
import * as factoryModule from '../../factory';
import { ServerConfigError } from '../../common-errors/server-config-error';
import { CamsRole, CamsSession } from '../../../../../common/src/cams/session';
import { urlRegex } from '../../../../../user-interface/src/lib/testing/testing-utilities';
import { OFFICES } from '../../../../../common/src/cams/test-utilities/offices.mock';

describe('user-session.gateway test', () => {
  const jwt = MockData.getJwt();
  const claims = {
    iss: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'api://default',
    iat: 0,
    exp: Number.MAX_SAFE_INTEGER,
    groups: [],
  };
  const provider = 'okta';
  const mockName = 'Mock User';
  const expectedSession = MockData.getCamsSession({
    user: { id: `userId-${mockName}`, name: mockName, offices: [], roles: [] },
    accessToken: jwt,
    provider,
  });
  const mockGetValue: CamsSession = {
    user: { id: 'userId-Wrong Name', name: 'Wrong Name' },
    accessToken: jwt,
    provider,
    issuer: 'http://issuer/',
    expires: Number.MAX_SAFE_INTEGER,
  };
  let context: ApplicationContext;
  let gateway: UserSessionGateway;

  beforeEach(async () => {
    gateway = new UserSessionGateway();
    context = await createMockApplicationContext({
      AUTH_ISSUER: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    });

    context.config.authConfig.provider = 'okta';
    context.config.authConfig.issuer = 'https://fake.okta.com/oauth2/default';
    context.config.authConfig.audience = 'api://default';

    const jwtHeader = {
      alg: 'RS256',
      typ: undefined,
      kid: '',
    };
    jest.spyOn(OktaGateway, 'verifyToken').mockResolvedValue({
      claims,
      header: jwtHeader as CamsJwtHeader,
    });
    jest
      .spyOn(OktaGateway, 'getUser')
      .mockResolvedValue({ id: `userId-${mockName}`, name: mockName });
    jest.spyOn(MockHumbleItem.prototype, 'read').mockResolvedValue({
      resource: mockGetValue,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should return valid session and add to cache when cache miss is encountered', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create').mockResolvedValue({
      resource: mockGetValue,
    });
    const session = await gateway.lookup(context, jwt, provider);
    expect(session).toEqual({
      ...expectedSession,
      expires: expect.any(Number),
      issuer: expect.stringMatching(urlRegex),
    });
    expect(createSpy).toHaveBeenCalled();
  });

  test('should return valid session on cache hit', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [expectedSession],
    });
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    const session = await gateway.lookup(context, jwt, provider);
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
      .spyOn(OktaGateway, 'verifyToken')
      .mockRejectedValue(new UnauthorizedError('TEST_USER_SESSION_GATEWAY'));
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    await expect(gateway.lookup(context, jwt, provider)).rejects.toThrow();
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should handle null jwt from authGateway', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    jest.spyOn(OktaGateway, 'verifyToken').mockResolvedValue(null);
    await expect(gateway.lookup(context, jwt, provider)).rejects.toThrow(UnauthorizedError);
  });

  test('should handle undefined jwt from authGateway', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    jest.spyOn(OktaGateway, 'verifyToken').mockResolvedValue(undefined);
    await expect(gateway.lookup(context, jwt, provider)).rejects.toThrow(UnauthorizedError);
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
      .spyOn(MockHumbleQuery.prototype, 'fetchAll')
      .mockResolvedValueOnce({
        resources: [],
      })
      .mockResolvedValue({
        resources: [expectedSession],
      });
    jest.spyOn(OktaGateway, 'verifyToken').mockRejectedValue(conflictError);
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    const session = await gateway.lookup(context, jwt, provider);
    expect(session).toEqual({
      ...expectedSession,
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
    jest.spyOn(OktaGateway, 'verifyToken').mockRejectedValue(new Error('Test error'));
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    await expect(gateway.lookup(context, jwt, provider)).rejects.toThrow(UnauthorizedError);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should throw ServerConfigError if factory does not return an OidcConnectGateway', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue(null);
    await expect(gateway.lookup(context, jwt, provider)).rejects.toThrow(ServerConfigError);
  });

  test('should use legacy behavior if restrict-case-assignment feature flag is not set', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValueOnce({
      resources: [],
    });

    jest.spyOn(factoryModule, 'getUserSessionCacheRepository').mockReturnValue({
      put: jest.fn(),
      get: jest.fn().mockResolvedValue(null),
    });

    jest.spyOn(factoryModule, 'getAuthorizationGateway').mockReturnValue(OktaGateway);

    const localContext = { ...context, featureFlags: { ...context.featureFlags } };
    localContext.featureFlags['restrict-case-assignment'] = false;

    const session = await gateway.lookup(localContext, jwt, provider);
    expect(session.user.offices).toEqual([
      OFFICES.find((office) => office.courtDivisionCode === '081'),
    ]);
    expect(session.user.roles).toEqual([CamsRole.CaseAssignmentManager]);
  });
});
