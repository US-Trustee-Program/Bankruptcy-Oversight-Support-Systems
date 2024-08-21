import { CamsRole } from '../../../../../common/src/cams/roles';
import { GroupDesignators } from '../gateways/storage/local-storage-gateway';

export type StorageGateway = {
  get(key: string): string | null;
  getOfficeMapping(): Map<string, GroupDesignators>;
  getRoleMapping(): Map<string, CamsRole>;
};
