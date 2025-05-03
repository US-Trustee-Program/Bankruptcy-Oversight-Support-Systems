import { UstpDivisionMeta } from '../../../../common/src/cams/offices';
import { CamsRole } from '../../../../common/src/cams/roles';

export type StorageGateway = {
  get(key: string): null | string;
  getPrivilegedIdentityUserRoleGroupName(): string;
  getRoleMapping(): Map<string, CamsRole>;
  getUstpDivisionMeta(): Map<string, UstpDivisionMeta>;
};
