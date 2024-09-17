import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../../common/src/cams/users';
import { CamsJwt } from '../../../../../common/src/cams/jwt';
import { ApplicationContext } from './basic';

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

export interface UserGroupGateway {
  getUserGroups: (context: ApplicationContext) => Promise<CamsUserGroup[]>;
  getUserGroupUsers(
    context: ApplicationContext,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]>;
}

export type UserGroupGatewayConfig = {
  provider: string | null;
  url: string | null;
  clientId: string | null;
  privateKey: string | null;
  keyId: string | null;
};
