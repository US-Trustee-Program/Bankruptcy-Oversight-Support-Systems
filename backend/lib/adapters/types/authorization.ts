import { CamsUser, CamsUserGroup, CamsUserReference } from '@common/cams/users';
import { CamsJwt } from '@common/cams/jwt';
import { ApplicationContext } from './basic';

export type AuthorizationConfig = {
  provider: string | null;
  issuer: string | null;
  audience: string | null;
  userInfoUri: string | null;
};

export interface OpenIdConnectGateway {
  getUser: (
    context: ApplicationContext,
    accessToken: string,
  ) => Promise<{ user: CamsUserReference; jwt: CamsJwt }>;
}

export interface Initializer<T> {
  init(options: T): Promise<void>;
}

export interface UserGroupGateway {
  getUserGroupWithUsers: (context: ApplicationContext, groupName: string) => Promise<CamsUserGroup>;
  getUserGroups: (context: ApplicationContext) => Promise<CamsUserGroup[]>;
  getUserGroupUsers(
    context: ApplicationContext,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]>;
  getUserById(context: ApplicationContext, userId: string): Promise<CamsUser>;
}

export type UserGroupGatewayConfig = {
  provider: string | null;
  url: string | null;
  token?: string | null;
  clientId?: string | null;
  privateKey?: string | null;
  keyId?: string | null;
};
