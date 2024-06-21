import { UserSessionGateway } from './user-session.gateway';
import OktaGateway from './okta/okta-gateway';
import { JwtHeader } from '../types/authorization';
import { ApplicationContext } from '../types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockHumbleItem, MockHumbleItems } from '../../testing/mock.cosmos-client-humble';
import {
  CamsSession,
  MOCK_AUTHORIZATION_BEARER_TOKEN,
} from '../../../../../common/src/cams/session';

describe('user-session.gateway test', () => {
  const jwtClaims = {
    iss: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'api://default',
    iat: 0,
    exp: 1,
  };
  const provider = 'okta';
  const mockUserName = 'Mock User';
  const expectedSession: CamsSession = {
    user: { name: mockUserName },
    apiToken: MOCK_AUTHORIZATION_BEARER_TOKEN,
    provider,
    validatedClaims: jwtClaims,
  };
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext({
      DATABASE_MOCK: 'true',
      AUTH_ISSUER: 'https://nonsense-3wjj23473kdwh2.okta.com/oauth2/default',
    });
    const jwtHeader = {
      alg: 'RS256',
      typ: undefined,
      kid: '',
    };
    const mockGetValue = {
      user: { name: 'Wrong Name' },
      apiToken: MOCK_AUTHORIZATION_BEARER_TOKEN,
      provider,
      validatedClaims: jwtClaims,
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
    jest.spyOn(MockHumbleItem.prototype, 'read').mockResolvedValue({
      resource: undefined,
    });
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    const gateway = new UserSessionGateway();
    const session = await gateway.lookup(context, MOCK_AUTHORIZATION_BEARER_TOKEN, provider);
    expect(session).toEqual(expectedSession);
    expect(createSpy).toHaveBeenCalled();
  });

  test('should return valid session on cache hit', async () => {
    jest.spyOn(MockHumbleItem.prototype, 'read').mockResolvedValue({
      resource: expectedSession,
    });
    const createSpy = jest.spyOn(MockHumbleItems.prototype, 'create');
    const gateway = new UserSessionGateway();
    const session = await gateway.lookup(context, MOCK_AUTHORIZATION_BEARER_TOKEN, provider);
    expect(session).toEqual(expectedSession);
    expect(createSpy).not.toHaveBeenCalled();
  });

  test('should not add anything to cache if token is invalid', () => {});
});
