import * as dotenv from 'dotenv';
import { AuthorizationConfig } from '../adapters/types/authorization';

dotenv.config();

const issuer = process.env.AUTH_ISSUER;
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
  console.log('issuer--------', issuer);
  const regex = /^https?:\/{2}[^/]+.okta.com/gm;
  const domainName = issuer.match(regex);
  if (domainName) return 'okta';
  return null;
}

function getAudienceFromIssuer(issuer: string) {
  const serverName = issuer.slice(issuer.lastIndexOf('/') + 1);
  return `api://${serverName}`;
}

function getUserInfoUriFromIssuer(issuer: string) {
  return issuer + '/v1/userinfo';
}
