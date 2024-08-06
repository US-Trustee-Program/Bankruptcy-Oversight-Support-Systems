import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../adapters/types/basic';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { MockUser, MockUsers } from '../../../../../common/src/cams/test-utilities/mock-user';
import {
  CamsJwt,
  CamsJwtClaims,
  CamsJwtHeader,
  OpenIdConnectGateway,
} from '../../adapters/types/authorization';
import { OFFICES } from '../../../../../common/src/cams/test-utilities/offices.mock';
import { CamsUser } from '../../../../../common/src/cams/users';
import { CamsRole } from '../../../../../common/src/cams/roles';

const MODULE_NAME = 'MOCK_OAUTH2_GATEWAY';
const mockUsers: MockUser[] = MockUsers;
// TODO: Do we want to lock this down further?
const key = 'mock-secret'; //pragma: allowlist secret

export async function mockAuthentication(context: ApplicationContext): Promise<string> {
  if (context.config.authConfig.provider !== 'mock') {
    throw new ForbiddenError(MODULE_NAME, { message: 'Not in mock mode...' });
  }
  const requestedSubject = context.req.body as Pick<MockUser, 'sub'>;
  const validMockRole = mockUsers.find((role) => role.sub === requestedSubject.sub);

  const ONE_DAY = 60 * 60 * 24;
  const SECONDS_SINCE_EPOCH = Math.floor(Date.now() / 1000);

  const claims: CamsJwtClaims = {
    aud: 'api://default',
    sub: validMockRole.sub,
    iss: context.req.url,
    exp: SECONDS_SINCE_EPOCH + ONE_DAY,
    groups: [],
  };

  const token = jwt.sign(claims, key);
  return token;
}

export async function verifyToken(accessToken: string): Promise<CamsJwt> {
  const payload = jwt.verify(accessToken, key) as jwt.JwtPayload;
  const claims: CamsJwtClaims = {
    iss: payload.iss!,
    sub: payload.sub!,
    aud: payload.aud!,
    exp: payload.exp!,
    groups: payload.groups!,
    ...payload,
  };

  const header: CamsJwtHeader = { typ: '' };
  const camsJwt: CamsJwt = {
    claims,
    header,
  };
  return camsJwt;
}

function addSuperUserOffices(user: CamsUser) {
  if (user.roles.includes(CamsRole.SuperUser)) {
    user.offices = OFFICES;
  }
}

export async function getUser(accessToken: string) {
  const decodedToken = jwt.decode(accessToken);
  const mockUser = mockUsers.find((role) => role.sub === decodedToken.sub);
  addSuperUserOffices(mockUser.user);
  return mockUser.user;
}

const MockOpenIdConnectGateway: OpenIdConnectGateway = {
  verifyToken,
  getUser,
};

export default MockOpenIdConnectGateway;
