import * as dotenv from 'dotenv';
import { AuthorizationConfig } from '../adapters/types/authorization';

dotenv.config();

const issuer = process.env.AUTH_ISSUER;
const audience = getAudienceFromIssuer(issuer);
const provider = getProviderFromIssuer(issuer);
const userInfoUri = getUserInfoUriFromIssuer(issuer);

const authorizationConfig = {
  issuer,
  audience,
  provider,
  userInfoUri,
};

export function getAuthorizationConfig(): AuthorizationConfig {
  return authorizationConfig;
}

function getProviderFromIssuer(issuer: string) {
  // TODO: Use regex to better guard against unintended substring matches.
  if (issuer.includes('okta.com')) return 'okta';
  return null;
}

function getAudienceFromIssuer(issuer: string) {
  const serverName = issuer.slice(issuer.lastIndexOf('/') + 1);
  return `api://${serverName}`;
}

function getUserInfoUriFromIssuer(issuer: string) {
  return issuer + '/v1/userinfo';
}
