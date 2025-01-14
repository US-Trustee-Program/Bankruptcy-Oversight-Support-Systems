import { CamsRole } from '../../../../common/src/cams/roles';
import { UstpDivisionMeta } from '../../../../common/src/cams/offices';

export type StorageGateway = {
  get(key: string): string | null;
  getRoleMapping(): Map<string, CamsRole>;
  getUstpDivisionMeta(): Map<string, UstpDivisionMeta>;
  getAugmentableUserRoleGroupName(): string;
};
