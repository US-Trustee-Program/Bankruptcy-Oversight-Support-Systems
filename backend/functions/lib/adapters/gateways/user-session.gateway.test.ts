import { UserSessionGateway } from './user-session.gateway';
import OktaGateway from './okta/okta-gateway';
import { JwtHeader } from '../types/authorization';

describe('user-session.gateway test', () => {
  const jwtClaims = {
    iss: 'https://dev-31938913.okta.com/oauth2/default',
    sub: 'user@fake.com',
    aud: 'api://default',
    iat: 0,
    exp: 1,
  };
  beforeEach(() => {
    const jwtHeader = {
      alg: 'RS256',
      typ: undefined,
      kid: '',
    };
    jest.spyOn(OktaGateway, 'verifyToken').mockResolvedValue({
      claims: jwtClaims,
      header: jwtHeader as JwtHeader,
      toString: () => {
        return '';
      },
      isExpired: () => {
        return false;
      },
      isNotBefore: () => {
        return false;
      },
    });
  });

  test('should return valid session when not in cache', async () => {
    const token = 't3st1d';
    const gateway = new UserSessionGateway();
    const session = await gateway.lookup(token);
    expect(session).toEqual({
      user: { name: '' },
      apiToken: token,
      provider: '',
      validatedClaims: jwtClaims,
    });
  });
});
