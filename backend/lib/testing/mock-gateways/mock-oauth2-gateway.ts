import * as jwt from 'jsonwebtoken';

import { CamsJwt, CamsJwtClaims, CamsJwtHeader } from '../../../../common/src/cams/jwt';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';
import { CamsRole } from '../../../../common/src/cams/roles';
import { MockUser, MockUsers } from '../../../../common/src/cams/test-utilities/mock-user';
import { CamsUser } from '../../../../common/src/cams/users';
import { nowInSeconds } from '../../../../common/src/date-helper';
import { OpenIdConnectGateway } from '../../adapters/types/authorization';
import { ApplicationContext } from '../../adapters/types/basic';
import { ForbiddenError } from '../../common-errors/forbidden-error';

const MODULE_NAME = 'MOCK-OAUTH2-GATEWAY';
const mockUsers: MockUser[] = MockUsers;
const key = 'mock-secret'; //pragma: allowlist secret

const EXPIRE_OVERRIDE = parseInt(process.env.MOCK_SESSION_EXPIRE_LENGTH);

export async function getUser(accessToken: string) {
  const decodedToken = jwt.decode(accessToken);
  const mockUser = mockUsers.find((role) => role.sub === decodedToken.sub);
  addSuperUserOffices(mockUser.user);
  return { groups: [], jwt: {} as CamsJwt, user: mockUser.user };
}

export async function mockAuthentication(context: ApplicationContext): Promise<string> {
  if (context.config.authConfig.provider !== 'mock') {
    throw new ForbiddenError(MODULE_NAME, { message: 'Not in mock mode...' });
  }
  const requestedSubject = (await context.request.body) as Pick<MockUser, 'sub'>;
  const validMockRole = mockUsers.find((role) => role.sub === requestedSubject.sub);

  const ONE_DAY = 60 * 60 * 24;
  const NOW = nowInSeconds();

  const expiration = isNaN(EXPIRE_OVERRIDE) ? NOW + ONE_DAY : NOW + EXPIRE_OVERRIDE;

  const claims: CamsJwtClaims = {
    aud: 'api://default',
    exp: expiration,
    groups: [],
    iss: context.request.url,
    sub: validMockRole.sub,
  };

  const token = jwt.sign(claims, key);
  return token;
}

export async function verifyToken(accessToken: string): Promise<CamsJwt> {
  const payload = jwt.verify(accessToken, key) as jwt.JwtPayload;
  const claims: CamsJwtClaims = {
    aud: payload.aud!,
    exp: payload.exp!,
    groups: payload.groups!,
    iss: payload.iss!,
    sub: payload.sub!,
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
    user.offices = MOCKED_USTP_OFFICES_ARRAY;
    user.roles = Object.values(CamsRole);
  }
}

const MockOpenIdConnectGateway: OpenIdConnectGateway = {
  getUser,
};

export default MockOpenIdConnectGateway;
