export type CamsJwt = {
  claims: CamsJwtClaims;
  header: CamsJwtHeader;
};

export type CamsJwtClaims = {
  [key: string]: unknown;
  aud: string | string[];
  exp: number;
  groups?: string[];
  iat?: number;
  iss: string;
  jti?: string;
  nbf?: number;
  sub: string;
};

export type CamsJwtHeader = {
  [key: string]: unknown;
  typ: string;
};

export function isCamsJwt(maybe: unknown): maybe is CamsJwt {
  return !!maybe && typeof maybe === 'object' && 'claims' in maybe && 'header' in maybe;
}
