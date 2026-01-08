/* eslint-disable-next-line @typescript-eslint/no-require-imports */
import OktaJwtVerifier = require('@okta/jwt-verifier');
import { CamsJwt } from '@common/cams/jwt';

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
