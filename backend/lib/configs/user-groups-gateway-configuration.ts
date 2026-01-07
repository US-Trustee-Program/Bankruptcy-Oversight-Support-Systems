import * as dotenv from 'dotenv';
import { UserGroupGatewayConfig } from '../adapters/types/authorization';
import { keyValuesToRecord } from '@common/cams/utilities';

dotenv.config();

const provider = ['okta', 'mock', 'none'].includes(process.env.CAMS_LOGIN_PROVIDER)
  ? process.env.CAMS_LOGIN_PROVIDER
  : null;

let userGroupGatewayConfig: UserGroupGatewayConfig;

if (provider === 'okta') {
  userGroupGatewayConfig = {
    token: process.env.OKTA_API_KEY,
    ...keyValuesToRecord(process.env.CAMS_USER_GROUP_GATEWAY_CONFIG),
    provider,
  } as const as UserGroupGatewayConfig;
} else {
  userGroupGatewayConfig = {} as const as UserGroupGatewayConfig;
}

export function getUserGroupGatewayConfig(): UserGroupGatewayConfig {
  return userGroupGatewayConfig;
}
