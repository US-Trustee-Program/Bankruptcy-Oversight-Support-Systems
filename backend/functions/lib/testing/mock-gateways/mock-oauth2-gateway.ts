import * as jwt from 'jsonwebtoken';
import { ApplicationContext } from '../../adapters/types/basic';
import { ForbiddenError } from '../../common-errors/forbidden-error';
import { MockRole, usersWithRole } from '../../../../../common/src/cams/mock-role';
import {
  CamsJwt,
  CamsJwtClaims,
  CamsJwtHeader,
  OpenIdConnectGateway,
} from '../../adapters/types/authorization';

const MODULE_NAME = 'MOCK_OAUTH2_GATEWAY';
const mockRoles: MockRole[] = usersWithRole;
// TODO: Do we want to lock this down further?
const secretKey = 'mock-secret'; //pragma: allowlist secret

export async function mockAuthentication(context: ApplicationContext): Promise<string> {
  if (context.config.authConfig.provider !== 'mock') {
    throw new ForbiddenError(MODULE_NAME);
  }
  const requestedSubject = context.req.body as Pick<MockRole, 'sub'>;
  const validMockRole = mockRoles.find((role) => role.sub === requestedSubject.sub);

  const ONE_DAY = 60 * 60 * 24;
  const SECONDS_SINCE_EPOCH = Math.floor(Date.now() / 1000);

  const claims: CamsJwtClaims = {
    aud: 'api://default',
    sub: validMockRole.sub,
    iss: context.req.url,
    exp: SECONDS_SINCE_EPOCH + ONE_DAY,
  };

  const token = jwt.sign(claims, secretKey);
  return token;
}

export async function verifyToken(accessToken: string): Promise<CamsJwt> {
  const payload = jwt.verify(accessToken, secretKey) as jwt.JwtPayload;
  const claims: CamsJwtClaims = {
    iss: payload.iss!,
    sub: payload.sub!,
    aud: payload.aud!,
    exp: payload.exp!,
    ...payload,
  };

  const header: CamsJwtHeader = { typ: '' };
  const camsJwt: CamsJwt = {
    claims,
    header,
  };
  return camsJwt;
}

export async function getUser(accessToken: string) {
  const decodedToken = jwt.decode(accessToken);
  const role = mockRoles.find((role) => role.sub === decodedToken.sub);
  return role.user;
}

const MockOpenIdConnectGateway: OpenIdConnectGateway = {
  verifyToken,
  getUser,
};

export default MockOpenIdConnectGateway;
