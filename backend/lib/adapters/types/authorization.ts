import { CamsJwt } from '../../../../common/src/cams/jwt';
import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../common/src/cams/users';
import { ApplicationContext } from './basic';

export type AuthorizationConfig = {
  audience: null | string;
  issuer: null | string;
  provider: null | string;
  userInfoUri: null | string;
};

export interface OpenIdConnectGateway {
  getUser: (accessToken: string) => Promise<{ jwt: CamsJwt; user: CamsUserReference }>;
}

export interface UserGroupGateway {
  getUserById(context: ApplicationContext, userId: string): Promise<CamsUser>;
  getUserGroups: (context: ApplicationContext) => Promise<CamsUserGroup[]>;
  getUserGroupUsers(
    context: ApplicationContext,
    group: CamsUserGroup,
  ): Promise<CamsUserReference[]>;
  getUserGroupWithUsers: (context: ApplicationContext, groupName: string) => Promise<CamsUserGroup>;
  init(config: UserGroupGatewayConfig): Promise<void>;
}

export type UserGroupGatewayConfig = {
  clientId?: null | string;
  keyId?: null | string;
  privateKey?: null | string;
  provider: null | string;
  token?: null | string;
  url: null | string;
};
