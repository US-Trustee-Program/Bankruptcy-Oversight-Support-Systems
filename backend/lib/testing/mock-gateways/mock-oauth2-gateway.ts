import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../adapters/types/basic';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import MockUsers, { MockUser } from '@common/cams/test-utilities/mock-user';
import { CamsUser } from '@common/cams/users';
import { CamsRole } from '@common/cams/roles';
import { CamsJwt, CamsJwtClaims } from '@common/cams/jwt';
import { OpenIdConnectGateway } from '../../adapters/types/authorization';
import { MOCKED_USTP_OFFICES_ARRAY } from '@common/cams/test-utilities/offices.mock';
import DateHelper from '@common/date-helper';

const MODULE_NAME = 'MOCK-OAUTH2-GATEWAY';
const mockUsers: MockUser[] = MockUsers;
const key = 'mock-secret'; //pragma: allowlist secret

const EXPIRE_OVERRIDE = parseInt(process.env.MOCK_SESSION_EXPIRE_LENGTH);

export async function mockAuthentication(context: ApplicationContext): Promise<string> {
  if (context.config.authConfig.provider !== 'mock') {
    throw new ForbiddenError(MODULE_NAME, { message: 'Not in mock mode...' });
  }
  const requestedSubject = (await context.request.body) as Pick<MockUser, 'sub'>;
  const validMockRole = mockUsers.find((role) => role.sub === requestedSubject.sub);

  const ONE_DAY = 60 * 60 * 24;
  const NOW = DateHelper.nowInSeconds();

  const expiration = isNaN(EXPIRE_OVERRIDE) ? NOW + ONE_DAY : NOW + EXPIRE_OVERRIDE;

  const claims: CamsJwtClaims = {
    aud: 'api://default',
    sub: validMockRole.sub,
    iss: context.request.url,
    exp: expiration,
    groups: [],
  };

  const token = jwt.sign(claims, key);
  return token;
}

function addSuperUserOffices(user: CamsUser) {
  if (user.roles.includes(CamsRole.SuperUser)) {
    user.offices = MOCKED_USTP_OFFICES_ARRAY;
    user.roles = Object.values(CamsRole);
  }
}

export async function getUser(_context: ApplicationContext, accessToken: string) {
  const decodedToken = jwt.decode(accessToken);
  const mockUser = mockUsers.find((role) => role.sub === decodedToken.sub);
  addSuperUserOffices(mockUser.user);
  return { user: mockUser.user, groups: [], jwt: {} as CamsJwt };
}

const MockOpenIdConnectGateway: OpenIdConnectGateway = {
  getUser,
};

export default MockOpenIdConnectGateway;
