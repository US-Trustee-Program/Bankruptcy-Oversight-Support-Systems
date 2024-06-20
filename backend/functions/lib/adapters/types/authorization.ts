import { CamsUser } from '../../../../../common/src/cams/session';

export type AuthorizationConfig = {
  provider: string;
  issuer: string;
  audience: string;
  userInfoUri: string;
};

export interface OpenIdConnectGateway {
  verifyToken: (accessToken: string) => Promise<Jwt>;
  getUser: (accessToken: string) => Promise<CamsUser>;
}

export type Algorithm =
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

export type JwtHeader = {
  alg: Algorithm;
  typ: string;
  kid?: string;
  jku?: string;
  x5u?: string;
  x5t?: string;
};

export type JwtClaims = {
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

export type Jwt = {
  claims: JwtClaims;
  header: JwtHeader;
  toString(): string;
  isExpired(): boolean;
  isNotBefore(): boolean;
};
