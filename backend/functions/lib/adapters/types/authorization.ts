import { CamsUser } from '../../../../../common/src/cams/users';
import { CamsJwt } from '../../../../../common/src/cams/jwt';

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
