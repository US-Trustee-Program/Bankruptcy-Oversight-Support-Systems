import { CamsRole } from '../../../../common/src/cams/roles';

export type StorageGateway = {
  get(key: string): string | null;
  getRoleMapping(): Map<string, CamsRole>;
  getPrivilegedIdentityUserRoleGroupName(): string;
};
