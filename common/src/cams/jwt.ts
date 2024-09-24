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
  groups?: string[];
  [key: string]: unknown;
};

export type CamsJwt = {
  claims: CamsJwtClaims;
  header: CamsJwtHeader;
};
