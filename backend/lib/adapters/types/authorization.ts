import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../common/src/cams/users';
import { CamsJwt } from '../../../../common/src/cams/jwt';
import { ApplicationContext } from './basic';

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
  getUserGroupWithUsers: (
    context: ApplicationContext,
    config: UserGroupGatewayConfig,
    groupName: string,
  ) => Promise<CamsUserGroup>;
  getUserGroups: (
    context: ApplicationContext,
    config: UserGroupGatewayConfig,
  ) => Promise<CamsUserGroup[]>;
  getUserGroupUsers(
    context: ApplicationContext,
    config: UserGroupGatewayConfig,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]>;
  getUserById(
    context: ApplicationContext,
    config: UserGroupGatewayConfig,
    userId: string,
  ): Promise<CamsUser>;
}

export type UserGroupGatewayConfig = {
  provider: string | null;
  url: string | null;
  token?: string | null;
  clientId?: string | null;
  privateKey?: string | null;
  keyId?: string | null;
};
