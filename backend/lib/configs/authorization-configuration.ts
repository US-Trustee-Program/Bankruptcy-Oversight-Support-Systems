import * as dotenv from 'dotenv';
import { AuthorizationConfig } from '../adapters/types/authorization';
import { EnvLoginConfig } from 'common/cams/login';
import { keyValuesToRecord } from 'common/cams/utilities';

dotenv.config();

const provider = ['okta', 'mock', 'none'].includes(process.env.CAMS_LOGIN_PROVIDER)
  ? process.env.CAMS_LOGIN_PROVIDER
  : null;
const doMockAuth = provider === 'mock';
const config = doMockAuth
  ? ({} as EnvLoginConfig)
  : keyValuesToRecord(process.env.CAMS_LOGIN_PROVIDER_CONFIG);

const issuer = URL.canParse(config.issuer) ? config.issuer : null;

const authorizationConfig = doMockAuth
  ? ({ issuer, audience: null, provider, userInfoUri: null } as const)
  : ({
      issuer,
      provider,
      audience: getAudienceFromIssuer(issuer),
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
