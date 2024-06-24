import { Jwt } from '../../types/authorization';
import OktaJwtVerifier = require('@okta/jwt-verifier');

export async function verifyAccessToken(
  issuer: string,
  token: string,
  audience: string,
): Promise<Jwt> {
  const oktaJwtVerifier = new OktaJwtVerifier({ issuer });
  return await oktaJwtVerifier.verifyAccessToken(token, audience);
}
