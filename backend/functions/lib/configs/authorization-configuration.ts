import * as dotenv from 'dotenv';
import { AuthorizationConfig } from '../adapters/types/authorization';
import { EnvLoginConfig } from '../../../../common/src/cams/login';

dotenv.config();

function safeParseConfig(configJson: string): EnvLoginConfig {
  try {
    return JSON.parse(configJson) as EnvLoginConfig;
  } catch {
    return {} as EnvLoginConfig;
  }
}

const doMockAuth = process.env.CAMS_LOGIN_PROVIDER === 'mock';
const config = doMockAuth
  ? ({} as EnvLoginConfig)
  : safeParseConfig(process.env.CAMS_LOGIN_PROVIDER_CONFIG);

const issuer = URL.canParse(config.issuer) ? config.issuer : null;

const authorizationConfig = doMockAuth
  ? ({ issuer, audience: null, provider: 'mock', userInfoUri: null } as const)
  : ({
      issuer,
      audience: getAudienceFromIssuer(issuer),
      provider: getProviderFromIssuer(issuer),
      userInfoUri: getUserInfoUriFromIssuer(issuer),
    } as const);

export function getAuthorizationConfig(): AuthorizationConfig {
  return authorizationConfig;
}

function getProviderFromIssuer(issuer: string) {
  if (!issuer) return null;
  if (issuer === 'https://dojlogin-test.usdoj.gov/oauth2/default') return 'okta';

  const issuerHost = new URL(issuer).hostname;
  const domainParts = issuerHost.split('.');
  const assembledDomain = domainParts.slice(-2).join('.');
  const acceptedDomains = ['okta.com', 'okta-gov.com'];
  if (acceptedDomains.includes(assembledDomain)) return 'okta';

  return null;
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
