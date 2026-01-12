import { CamsRoleType } from '@common/cams/roles';

export type StorageGateway = {
  get(key: string): string | null;
  getRoleMapping(): Map<string, CamsRoleType>;
  getPrivilegedIdentityUserRoleGroupName(): string;
};
