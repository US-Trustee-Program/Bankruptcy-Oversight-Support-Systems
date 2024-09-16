import { CamsRole } from '../../../../../common/src/cams/roles';
import { GroupDesignators } from '../gateways/storage/local-storage-gateway';
import { UstpOfficeDetails } from '../../../../../common/src/cams/courts';

export type StorageGateway = {
  get(key: string): string | null;
  getOfficeMapping(): Map<string, GroupDesignators>;
  getUstpOffices(): Map<string, UstpOfficeDetails>;
  getRoleMapping(): Map<string, CamsRole>;
};
