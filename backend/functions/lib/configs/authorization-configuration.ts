import * as dotenv from 'dotenv';
import { AuthorizationConfig } from '../adapters/types/authorization';

dotenv.config();

const issuer = URL.canParse(process.env.AUTH_ISSUER) ? process.env.AUTH_ISSUER : null;
const authorizationConfig = {
  issuer,
  audience: getAudienceFromIssuer(issuer),
  provider: getProviderFromIssuer(issuer),
  userInfoUri: getUserInfoUriFromIssuer(issuer),
} as const;

export function getAuthorizationConfig(): AuthorizationConfig {
  return authorizationConfig;
}

function getProviderFromIssuer(issuer: string) {
  if (!issuer) return null;

  const mockIssuers = [
    'http://localhost:7071/api/oauth2/default',
    'https://ustp-cams-stg-node-api.azurewebsites.us/oauth2/default',
    'https://ustp-cams-dev-eaf2eb-node-api.azurewebsites.us/oauth2/default',
  ];
  if (mockIssuers.includes(issuer)) return 'mock';

  const regex = /^https?:\/{2}[^/]+.okta.com/gm;
  const domainName = issuer.match(regex);
  if (domainName) return 'okta';
  return null;
}

function getAudienceFromIssuer(issuer: string) {
  if (!issuer) return null;
  const issuerUrl = new URL(issuer);
  const serverName = issuerUrl.pathname.slice(issuerUrl.pathname.lastIndexOf('/') + 1);
  return `api://${serverName}`;
}

function getUserInfoUriFromIssuer(issuer: string) {
  if (!issuer) return null;
  return issuer + '/v1/userinfo';
}
