import { CamsUser } from '../../../../../common/src/cams/session';

export type AuthorizationConfig = {
  provider: string | null;
  issuer: string | null;
  audience: string | null;
  userInfoUri: string | null;
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
  aud: string | string[];
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
