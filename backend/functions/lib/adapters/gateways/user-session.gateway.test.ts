import { ConflictError, isConflictError, UserSessionGateway } from './user-session.gateway';
import OktaGateway from './okta/okta-gateway';
import { JwtHeader } from '../types/authorization';
import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import {
  MockHumbleItem,
  MockHumbleItems,
  MockHumbleQuery,
} from '../../testing/mock.cosmos-client-humble';
import { CamsSession } from '../../../../../common/src/cams/session';
import { MockData } from '../../../../../common/src/cams/test-utilities/mock-data';
import { UnauthorizedError } from '../../common-errors/unauthorized-error';

describe('user-session.gateway test', () => {
  const jwt = MockData.getJwt();
  const jwtClaims = {
    iss: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'api://default',
    iat: 0,
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  const provider = 'okta';
  const mockUserName = 'Mock User';
  const expectedSession: CamsSession = {
    user: { name: mockUserName },
    apiToken: jwt,
    provider,
    validatedClaims: jwtClaims,
  };
  const mockGetValue = {
    user: { name: 'Wrong Name' },
    apiToken: jwt,
    provider,
    validatedClaims: jwtClaims,
    signature: '',
    ttl: 0,
  };
  let context: ApplicationContext;
  let gateway: UserSessionGateway;

  beforeEach(async () => {
    gateway = new UserSessionGateway();
    context = await createMockApplicationContext({
      AUTH_ISSUER: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    });
    const jwtHeader = {
      alg: 'RS256',
      typ: undefined,
      kid: '',
    };
    jest.spyOn(OktaGateway, 'verifyToken').mockResolvedValue({
      claims: jwtClaims,
      header: jwtHeader as JwtHeader,
      toString: jest.fn(),
      isExpired: jest.fn(),
      isNotBefore: jest.fn(),
    });
    jest.spyOn(OktaGateway, 'getUser').mockResolvedValue({ name: mockUserName });
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
    expect(session).toEqual(expectedSession);
    expect(createSpy).toHaveBeenCalled();
  });

  test('should return valid session on cache hit', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [expectedSession],
    });
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    const session = await gateway.lookup(context, jwt, provider);
    expect(session).toEqual(expectedSession);
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

  test.skip('should return valid session and NOT add to cache when Conflict error is received', async () => {
    jest.spyOn(MockHumbleQuery.prototype, 'fetchAll').mockResolvedValue({
      resources: [],
    });
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
    jest.spyOn(OktaGateway, 'verifyToken').mockRejectedValue(conflictError);
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    const session = await gateway.lookup(context, jwt, provider);
    expect(session).toEqual(expectedSession);
    expect(createSpy).toHaveBeenCalled();
  });

  test.skip('should properly identify Conflict error', () => {
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
});
