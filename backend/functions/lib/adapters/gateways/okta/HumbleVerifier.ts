import { CamsJwt } from '../../types/authorization';
import OktaJwtVerifier = require('@okta/jwt-verifier');

type Algorithm =
  | 'HS256'
  | 'HS384'
  | 'HS512'
  | 'RS256'
  | 'RS384'
  | 'RS512'
  | 'ES256'
  | 'ES384'
  | 'ES512'
  | 'none';

type JwtHeader = {
  alg: Algorithm;
  typ: string;
  kid?: string;
  jku?: string;
  x5u?: string;
  x5t?: string;
};

type JwtClaims = {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  nonce?: string;
  scp?: string[];
  [key: string]: unknown;
};

type Jwt = {
  claims: JwtClaims;
  header: JwtHeader;
  toString(): string;
  isExpired(): boolean;
  isNotBefore(): boolean;
};

export async function verifyAccessToken(
  issuer: string,
  token: string,
  audience: string,
): Promise<CamsJwt> {
  const oktaJwtVerifier = new OktaJwtVerifier({ issuer });
  const oktaJwt: Jwt = await oktaJwtVerifier.verifyAccessToken(token, audience);

  return { claims: { ...oktaJwt.claims }, header: { ...oktaJwt.header } };
}
