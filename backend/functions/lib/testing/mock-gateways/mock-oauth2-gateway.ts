import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsUser } from '../../../../../common/src/cams/session';
import { ForbiddenError } from '../../common-errors/forbidden-error';

dotenv.config();

const MODULE_NAME = 'MOCK_OAUTH2_GATEWAY';

// TODO: This is a terrible type name...
type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
};

const authIssuer = process.env.AUTH_ISSUER;
const mockUsersJson = process.env.MOCK_USERS;
const mockUsers: MockUser[] = mockUsersJson ? JSON.parse(mockUsersJson) : [];
const secretKey = randomUUID();

export async function mockAuthentication(context: ApplicationContext): Promise<string> {
  if (!authIssuer || !mockUsersJson || authIssuer !== context.req.url) {
    throw new ForbiddenError(MODULE_NAME);
  }

  const requestedSubject = context.req.body as MockUser;
  console.log('requested subject', requestedSubject);

  const validMockUser = mockUsers.find((user) => user.sub === requestedSubject.sub);

  const payload = {
    aud: 'api://default',
    sub: validMockUser.sub,
    iss: context.req.url,
  };

  console.log('payload', payload);

  const token = jwt.sign(payload, secretKey);
  return token;
}

export function mockVerifyToken(token: string) {
  return jwt.verify(token, secretKey);
}

const MockOauth2Gateway = {
  mockAuthentication,
  mockVerifyToken,
};

export default MockOauth2Gateway;
