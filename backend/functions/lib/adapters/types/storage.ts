import { CamsRole } from '../../../../../common/src/cams/roles';
import { UstpOfficeDetails } from '../../../../../common/src/cams/courts';

export type StorageGateway = {
  get(key: string): string | null;
  getUstpOffices(): Map<string, UstpOfficeDetails>;
  getRoleMapping(): Map<string, CamsRole>;
};
