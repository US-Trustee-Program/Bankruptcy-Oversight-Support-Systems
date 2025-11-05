import { CamsUser, CamsUserGroup, CamsUserReference } from '../../../../common/src/cams/users';
import { CamsJwt } from '../../../../common/src/cams/jwt';
import { ApplicationContext } from '../../use-cases/application.types';

export type AuthorizationConfig = {
  provider: string | null;
  issuer: string | null;
  audience: string | null;
  userInfoUri: string | null;
};

export interface OpenIdConnectGateway {
  getUser: (accessToken: string) => Promise<{ user: CamsUserReference; jwt: CamsJwt }>;
}

export interface UserGroupGateway {
  init(config: UserGroupGatewayConfig): Promise<void>;
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
