import * as dotenv from 'dotenv';
import { UserGroupGatewayConfig } from '../adapters/types/authorization';
import { keyValuesToRecord } from '../../../common/src/cams/utilities';

dotenv.config();

const provider = ['okta', 'mock', 'none'].includes(process.env.CAMS_LOGIN_PROVIDER)
  ? process.env.CAMS_LOGIN_PROVIDER
  : null;
const doMockAuth = provider === 'mock';

const userGroupGatewayConfig: UserGroupGatewayConfig = (
  doMockAuth
    ? ({} as const)
    : ({
        token: process.env.OKTA_API_KEY,
        ...keyValuesToRecord(process.env.CAMS_USER_GROUP_GATEWAY_CONFIG),
        provider,
      } as const)
) as UserGroupGatewayConfig;

export function getUserGroupGatewayConfig(): UserGroupGatewayConfig {
  return userGroupGatewayConfig;
}
