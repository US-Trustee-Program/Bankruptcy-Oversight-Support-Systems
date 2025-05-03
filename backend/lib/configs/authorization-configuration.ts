import * as dotenv from 'dotenv';

import { EnvLoginConfig } from '../../../common/src/cams/login';
import { keyValuesToRecord } from '../../../common/src/cams/utilities';
import { AuthorizationConfig } from '../adapters/types/authorization';

dotenv.config();

const provider = ['mock', 'none', 'okta'].includes(process.env.CAMS_LOGIN_PROVIDER)
  ? process.env.CAMS_LOGIN_PROVIDER
  : null;
const doMockAuth = provider === 'mock';
const config = doMockAuth
  ? ({} as EnvLoginConfig)
  : keyValuesToRecord(process.env.CAMS_LOGIN_PROVIDER_CONFIG);

const issuer = URL.canParse(config.issuer) ? config.issuer : null;

const authorizationConfig = doMockAuth
  ? ({ audience: null, issuer, provider: 'mock', userInfoUri: null } as const)
  : ({
      audience: getAudienceFromIssuer(issuer),
      issuer,
      provider,
      userInfoUri: getUserInfoUriFromIssuer(issuer),
    } as const);

export function getAuthorizationConfig(): AuthorizationConfig {
  return authorizationConfig;
}

function getAudienceFromIssuer(issuer: string) {
  if (!issuer) return null;
  const issuerUrl = new URL(issuer);
  const serverName = issuerUrl.pathname.slice(issuerUrl.pathname.lastIndexOf('/') + 1);
  if (!serverName) return null;

  return `api://${serverName}`;
}

function getUserInfoUriFromIssuer(issuer: string) {
  if (!issuer) return null;
  return issuer + '/v1/userinfo';
}
