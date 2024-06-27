import * as jwt from 'jsonwebtoken';
import { AzureFunction, Context, HttpRequest } from '@azure/functions';
import { secretKey } from '../lib/testing/mock-gateways/mock-oauth2-gateway';
import { httpSuccess } from '../lib/adapters/utils/http-response';

import * as dotenv from 'dotenv';
import { CamsUser } from '../../../common/src/cams/session';
dotenv.config();

// TODO: This is a terrible type name...
type MockUser = {
  sub: string;
  label: string;
  user: CamsUser;
};

const mockUsersJson = process.env.MOCK_USERS;
const mockUsers: MockUser[] = mockUsersJson ? JSON.parse(mockUsersJson) : [];

const mockOauth2Authentication: AzureFunction = async function (
  context: Context,
  request: HttpRequest,
): Promise<void> {
  // TODO: Need to load server side secrets
  // TODO: If the issuer is not self return HTTP 403 status for all requests.

  const bodyJson = request.body;
  // const requestedUser = JSON.parse(bodyJson) as MockUser;
  const requestedUser = bodyJson as MockUser;
  console.log('mockUser', requestedUser);

  const validMockUser = mockUsers.find((user) => user.sub === requestedUser.sub);

  const payload = {
    aud: 'api://default',
    sub: validMockUser.sub,
    iss: request.url,
  };

  console.log('payload', payload);

  const token = jwt.sign(payload, secretKey);
  context.res = httpSuccess({ token });
};

export default mockOauth2Authentication;
