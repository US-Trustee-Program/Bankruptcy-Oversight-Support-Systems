import { ForbiddenError } from '../../../common-errors/forbidden-error';
import OktaJwtVerifier = require('@okta/jwt-verifier');

// TODO: Externalize the issuer. Add this to the app configuration.
const issuer = `https://dev-31938913.okta.com/oauth2/default`;
const audience = getAudienceFromIssuer(issuer);

const oktaJwtVerifier = new OktaJwtVerifier({ issuer });

console.log('issuer', issuer);
console.log('audience', audience);

function getAudienceFromIssuer(issuer: string) {
  const serverName = issuer.slice(issuer.lastIndexOf('/') + 1);
  return `api://${serverName}`;
}

export async function oktaVerifyToken(token: string) {
  try {
    console.log('inside verifyToken', token);
    const verification = await oktaJwtVerifier.verifyAccessToken(token, audience);
    console.log('verification', verification);

    return verification;
  } catch (originalError) {
    console.error('OKTA ERROR', originalError);
    throw new ForbiddenError('AUTHORIZATION', { originalError });
  }
}
