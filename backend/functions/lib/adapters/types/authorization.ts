import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../../common/src/cams/users';
import { CamsJwt } from '../../../../../common/src/cams/jwt';

export type AuthorizationConfig = {
  provider: string | null;
  issuer: string | null;
  audience: string | null;
  userInfoUri: string | null;
};

export interface OpenIdConnectGateway {
  getUser: (accessToken: string) => Promise<{ user: CamsUser; jwt: CamsJwt }>;
}

export interface UserGroupGateway {
  getUserGroups: (config: UserGroupGatewayConfig) => Promise<CamsUserGroup[]>;
  getUserGroupUsers(
    config: UserGroupGatewayConfig,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]>;
}

export type UserGroupGatewayConfig = {
  provider: string | null;
  url: string | null;
  token?: string | null;
  clientId?: string | null;
  privateKey?: string | null;
  keyId?: string | null;
};
