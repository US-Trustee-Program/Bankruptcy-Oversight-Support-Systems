import { CamsUser } from '../../../../../common/src/cams/session';

export type AuthorizationConfig = {
  provider: string;
  issuer: string;
  audience: string;
  userInfoUri: string;
};

export interface OpenIdConnectGateway {
  verifyToken: (accessToken: string) => Promise<CamsJwt>;
  getUser: (accessToken: string) => Promise<CamsUser>;
}

export type CamsJwtHeader = {
  typ: string;
  [key: string]: unknown;
};

export type CamsJwtClaims = {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  [key: string]: unknown;
};

export type CamsJwt = {
  claims: CamsJwtClaims;
  header: CamsJwtHeader;
};
