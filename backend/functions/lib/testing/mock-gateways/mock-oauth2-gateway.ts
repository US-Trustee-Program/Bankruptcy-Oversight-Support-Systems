import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import { ApplicationContext } from '../../adapters/types/basic';
import { CamsUser } from '../../../../../common/src/cams/session';

export const secretKey = randomUUID();

dotenv.config();

// TODO: This is a terrible type name...
type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
};

const mockUsersJson = process.env.MOCK_USERS;
const mockUsers: MockUser[] = mockUsersJson ? JSON.parse(mockUsersJson) : [];

export async function mockAuthentication(context: ApplicationContext): Promise<string> {
  // TODO: Need to load server side secrets
  // TODO: If the issuer is not self return HTTP 403 status for all requests.

  const bodyJson = context.req.body;
  // const requestedUser = JSON.parse(bodyJson) as MockUser;
  const requestedUser = bodyJson as MockUser;
  console.log('mockUser', requestedUser);

  const validMockUser = mockUsers.find((user) => user.sub === requestedUser.sub);

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
