/* eslint-disable-next-line @typescript-eslint/no-require-imports */
import OktaJwtVerifier = require('@okta/jwt-verifier');

import { CamsJwt } from '../../../../../common/src/cams/jwt';

type Algorithm =
  | 'ES256'
  | 'ES384'
  | 'ES512'
  | 'HS256'
  | 'HS384'
  | 'HS512'
  | 'none'
  | 'RS256'
  | 'RS384'
  | 'RS512';

type Jwt = {
  claims: JwtClaims;
  header: JwtHeader;
  isExpired(): boolean;
  isNotBefore(): boolean;
  toString(): string;
};

type JwtClaims = {
  [key: string]: unknown;
  aud: string;
  exp: number;
  iat?: number;
  iss: string;
  jti?: string;
  nbf?: number;
  nonce?: string;
  scp?: string[];
  sub: string;
};

type JwtHeader = {
  alg: Algorithm;
  jku?: string;
  kid?: string;
  typ: string;
  x5t?: string;
  x5u?: string;
};

// This kinda violates the pure nature of a humble.
// We need to maintain an OktaJwtVerifier singleton.
const verifierMap = new Map<string, OktaJwtVerifier>();

export async function verifyAccessToken(
  issuer: string,
  token: string,
  audience: string,
): Promise<CamsJwt> {
  const jwksRequestsPerMinute = 50;
  if (!verifierMap.has(issuer)) {
    verifierMap.set(issuer, new OktaJwtVerifier({ issuer, jwksRequestsPerMinute }));
  }
  const oktaJwtVerifier = verifierMap.get(issuer);
  const oktaJwt: Jwt = await oktaJwtVerifier.verifyAccessToken(token, audience);

  return {
    claims: { ...oktaJwt.claims },
    header: { ...oktaJwt.header },
  };
}
